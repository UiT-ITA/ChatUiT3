using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record CopyFileArgs(
    [property: Description("driveId of the file or folder to copy.")]
    string DriveId,
    [property: Description("itemId of the file or folder to copy.")]
    string ItemId,
    [property: Description("itemId of the folder to copy into.")]
    string DestinationFolderId,
    [property: Description("driveId of the destination folder. Defaults to the source drive.")]
    string? DestinationDriveId,
    [property: Description("Name of the copy, including the extension. Defaults to the original name.")]
    string? NewName);

/// <summary>Copies a drive item after the user has approved it. Graph finishes the copy in the background.</summary>
public sealed class CopyFileFunction : ConfirmableTool<CopyFileArgs>
{
    private readonly GraphClient _graph;

    public CopyFileFunction(GraphClient graph) => _graph = graph;

    public override string Id => "copy_file";
    public override string DisplayName => "Copy file";
    public override string Description => "Copy a file or folder to another folder, in the same or another drive. The copy finishes in the background. The user must approve it first. If they reject it, do not retry or change it.";
    public override IReadOnlyList<string> RequiredScopes => DriveSupport.Scopes;

    protected override async Task<ToolPreview> PrepareAsync(CopyFileArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var item = await _graph.GetAsync(invocation.Context, $"{DriveSupport.ItemPath(args.DriveId, args.ItemId)}?$select=name", DriveSupport.Scopes, ct);
        var folder = await _graph.GetAsync(invocation.Context, $"{DriveSupport.ItemPath(DestinationDrive(args), args.DestinationFolderId)}?$select=name,webUrl", DriveSupport.Scopes, ct);

        var fields = new List<ToolPreviewField>
        {
            new("Copy", item.Str("name") ?? ""),
            new("Into folder", folder.Str("webUrl") ?? folder.Str("name") ?? "")
        };
        if (!string.IsNullOrWhiteSpace(args.NewName))
        {
            fields.Add(new ToolPreviewField("Name of copy", args.NewName.Trim()));
        }

        return new ToolPreview("Copy file", null, fields, AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(CopyFileArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var body = new Dictionary<string, object>
        {
            ["parentReference"] = new { driveId = DestinationDrive(args), id = args.DestinationFolderId.Trim() }
        };
        if (!string.IsNullOrWhiteSpace(args.NewName))
        {
            body["name"] = args.NewName.Trim();
        }

        await _graph.PostAsync(invocation.Context, $"{DriveSupport.ItemPath(args.DriveId, args.ItemId)}/copy", body, DriveSupport.Scopes, ct);
        return ToolResult.Ok(new { copyStarted = true }, "Copy started.");
    }

    private static string DestinationDrive(CopyFileArgs args)
        => string.IsNullOrWhiteSpace(args.DestinationDriveId) ? args.DriveId.Trim() : args.DestinationDriveId.Trim();
}
