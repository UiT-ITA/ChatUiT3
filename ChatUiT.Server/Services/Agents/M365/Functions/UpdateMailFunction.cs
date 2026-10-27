using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record UpdateMailArgs(
    [property: Description("Message id from search_mail or get_mail.")]
    string MessageId,
    [property: Description("Folder id or well-known name (inbox, archive, deleteditems, ...) to move the email to.")]
    string? MoveToFolder,
    [property: Description("Mark as read (true) or unread (false).")]
    bool? IsRead,
    [property: Description("Flag (true) or clear the flag (false).")]
    bool? Flagged,
    [property: Description("Outlook categories to set. Replaces the existing ones; an empty list clears them.")]
    List<string>? Categories);

/// <summary>Moves, marks, flags or categorises an email after the user has approved it.</summary>
public sealed class UpdateMailFunction : ConfirmableTool<UpdateMailArgs>
{
    private readonly GraphClient _graph;

    public UpdateMailFunction(GraphClient graph) => _graph = graph;

    public override string Id => "update_mail";
    public override string DisplayName => "Update email";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Move an email to a folder, mark it read or unread, flag it or set its categories. Only given fields change. The user must approve it first. If they reject it, do not retry or change it.";
    public override IReadOnlyList<string> RequiredScopes => MailSupport.WriteScopes;

    protected override async Task<ToolPreview> PrepareAsync(UpdateMailArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var changes = Changes(args);
        var message = await _graph.GetAsync(invocation.Context, $"{MessagePath(args)}?$select=subject,from", MailSupport.WriteScopes, ct);

        var fields = new List<ToolPreviewField> { new("Email", message.Str("subject") ?? "") };
        if (changes.ContainsKey("isRead"))
        {
            fields.Add(new ToolPreviewField("Mark as", args.IsRead == true ? "read" : "unread"));
        }

        if (changes.ContainsKey("flag"))
        {
            fields.Add(new ToolPreviewField("Flag", args.Flagged == true ? "flagged" : "cleared"));
        }

        if (changes.ContainsKey("categories"))
        {
            fields.Add(new ToolPreviewField("Categories", args.Categories!.Count == 0 ? "(none)" : string.Join(", ", args.Categories)));
        }

        if (!string.IsNullOrWhiteSpace(args.MoveToFolder))
        {
            fields.Add(new ToolPreviewField("Move to", args.MoveToFolder.Trim()));
        }

        return new ToolPreview("Update email", null, fields, AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(UpdateMailArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var changes = Changes(args);
        var messageId = args.MessageId.Trim();

        if (changes.Count > 0)
        {
            await _graph.PatchAsync(invocation.Context, MessagePath(args), changes, MailSupport.WriteScopes, ct);
        }

        if (!string.IsNullOrWhiteSpace(args.MoveToFolder))
        {
            // Moving gives the email a new id.
            var moved = await _graph.PostAsync(invocation.Context, $"{MessagePath(args)}/move", new { destinationId = args.MoveToFolder.Trim() }, MailSupport.WriteScopes, ct);
            messageId = moved.Str("id") ?? messageId;
        }

        return ToolResult.Ok(new { updated = true, messageId }, "Email updated.");
    }

    private static string MessagePath(UpdateMailArgs args)
    {
        if (string.IsNullOrWhiteSpace(args.MessageId))
        {
            throw new ToolArgumentException("messageId is required.");
        }

        return $"me/messages/{Uri.EscapeDataString(args.MessageId.Trim())}";
    }

    /// <summary>The PATCH body: only the properties the model asked to change.</summary>
    private static Dictionary<string, object> Changes(UpdateMailArgs args)
    {
        var changes = new Dictionary<string, object>();
        if (args.IsRead.HasValue)
        {
            changes["isRead"] = args.IsRead.Value;
        }

        if (args.Flagged.HasValue)
        {
            changes["flag"] = new { flagStatus = args.Flagged.Value ? "flagged" : "notFlagged" };
        }

        if (args.Categories != null)
        {
            changes["categories"] = args.Categories;
        }

        if (changes.Count == 0 && string.IsNullOrWhiteSpace(args.MoveToFolder))
        {
            throw new ToolArgumentException("Give at least one change: moveToFolder, isRead, flagged or categories.");
        }

        return changes;
    }
}
