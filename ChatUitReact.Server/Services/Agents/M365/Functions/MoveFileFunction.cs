using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record MoveFileArgs(
    [property: Description("driveId of the file or folder.")]
    string DriveId,
    [property: Description("itemId of the file or folder.")]
    string ItemId,
    [property: Description("itemId of the folder to move it into, in the same drive.")]
    string? DestinationFolderId,
    [property: Description("New name, including the extension.")]
    string? NewName);

/// <summary>Moves and/or renames a drive item after the user has approved it.</summary>
public sealed class MoveFileFunction : ConfirmableTool<MoveFileArgs>
{
    private readonly GraphClient _graph;

    public MoveFileFunction(GraphClient graph) => _graph = graph;

    public override string Id => "move_file";
    public override string DisplayName => "Move or rename file";
    public override string Description => "Move and/or rename a file or folder within the same OneDrive or SharePoint drive. The user must approve it first. If they reject it, do not retry or change it.";
    public override IReadOnlyList<string> RequiredScopes => DriveSupport.Scopes;

    protected override async Task<ToolPreview> PrepareAsync(MoveFileArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        Changes(args);
        var item = await _graph.GetAsync(invocation.Context, $"{DriveSupport.ItemPath(args.DriveId, args.ItemId)}?$select=name,parentReference", DriveSupport.Scopes, ct);

        var fields = new List<ToolPreviewField> { new("Item", $"{item.Str("parentReference", "path")?.Split(':', 2)[^1]}/{item.Str("name")}") };
        if (!string.IsNullOrWhiteSpace(args.DestinationFolderId))
        {
            var folder = await _graph.GetAsync(invocation.Context, $"{DriveSupport.ItemPath(args.DriveId, args.DestinationFolderId)}?$select=name,parentReference", DriveSupport.Scopes, ct);
            fields.Add(new ToolPreviewField("Move to", $"{folder.Str("parentReference", "path")?.Split(':', 2)[^1]}/{folder.Str("name")}"));
        }

        if (!string.IsNullOrWhiteSpace(args.NewName))
        {
            fields.Add(new ToolPreviewField("New name", args.NewName.Trim()));
        }

        return new ToolPreview("Move or rename file", null, fields, AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(MoveFileArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var item = await _graph.PatchAsync(invocation.Context, DriveSupport.ItemPath(args.DriveId, args.ItemId), Changes(args), DriveSupport.Scopes, ct);
        return ToolResult.Ok(new { moved = true, item = DriveSupport.Item(item) }, "Moved.");
    }

    private static Dictionary<string, object> Changes(MoveFileArgs args)
    {
        var changes = new Dictionary<string, object>();
        if (!string.IsNullOrWhiteSpace(args.DestinationFolderId))
        {
            changes["parentReference"] = new { id = args.DestinationFolderId.Trim() };
        }

        if (!string.IsNullOrWhiteSpace(args.NewName))
        {
            changes["name"] = args.NewName.Trim();
        }

        if (changes.Count == 0)
        {
            throw new ToolArgumentException("Give destinationFolderId, newName or both.");
        }

        return changes;
    }
}
