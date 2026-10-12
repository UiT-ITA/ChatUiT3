using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public enum SharingAccess
{
    View,
    Edit
}

public sealed record CreateSharingLinkArgs(
    [property: Description("driveId of the file or folder.")]
    string DriveId,
    [property: Description("itemId of the file or folder.")]
    string ItemId,
    SharingAccess Access,
    [property: Description("Email addresses to share with; they are notified. Omit for a link anyone in the organization can open.")]
    List<string>? Recipients);

/// <summary>Shares a drive item after the user has approved who gets access.</summary>
public sealed class CreateSharingLinkFunction : ConfirmableTool<CreateSharingLinkArgs>
{
    private readonly GraphClient _graph;

    public CreateSharingLinkFunction(GraphClient graph) => _graph = graph;

    public override string Id => "create_sharing_link";
    public override string DisplayName => "Share file";
    public override string Description => "Share a file or folder with view or edit access: with specific people (who are notified), or as a link for anyone in the organization. The user must approve it first.";
    public override IReadOnlyList<string> RequiredScopes => DriveSupport.Scopes;

    protected override async Task<ToolPreview> PrepareAsync(CreateSharingLinkArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var recipients = MailSupport.Addresses(args.Recipients);
        var item = await _graph.GetAsync(invocation.Context, $"{DriveSupport.ItemPath(args.DriveId, args.ItemId)}?$select=name,webUrl", DriveSupport.Scopes, ct);

        return new ToolPreview(
            "Share file",
            recipients.Count > 0 ? "The recipients are notified by email." : null,
            [
                new ToolPreviewField("File", item.Str("name") ?? ""),
                new ToolPreviewField("Access", args.Access == SharingAccess.Edit ? "Can edit" : "Can view"),
                new ToolPreviewField("Shared with", recipients.Count > 0 ? string.Join(", ", recipients) : "Anyone in the organization with the link")
            ],
            AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(CreateSharingLinkArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var recipients = MailSupport.Addresses(args.Recipients);
        var path = DriveSupport.ItemPath(args.DriveId, args.ItemId);

        if (recipients.Count == 0)
        {
            var link = await _graph.PostAsync(invocation.Context, $"{path}/createLink",
                new { type = args.Access == SharingAccess.Edit ? "edit" : "view", scope = "organization" }, DriveSupport.Scopes, ct);
            return ToolResult.Ok(new { shared = true, link = link.Str("link", "webUrl") }, "Link created.");
        }

        var invite = await _graph.PostAsync(invocation.Context, $"{path}/invite", new
        {
            recipients = recipients.Select(r => new { email = r }).ToList(),
            requireSignIn = true,
            sendInvitation = true,
            roles = new[] { args.Access == SharingAccess.Edit ? "write" : "read" }
        }, DriveSupport.Scopes, ct);

        var inviteLink = invite.Items().Select(p => p.Str("link", "webUrl")).FirstOrDefault(u => u != null);
        return ToolResult.Ok(new { shared = true, recipients, link = inviteLink }, "Shared.");
    }
}
