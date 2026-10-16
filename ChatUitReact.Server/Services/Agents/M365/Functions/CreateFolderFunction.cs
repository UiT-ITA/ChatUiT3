using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record CreateFolderArgs(
    [property: Description("Path of the new folder in the user's OneDrive, e.g. Documents/Project X. The parent folder must exist.")]
    string Path);

/// <summary>Creates a folder in the user's OneDrive after the user has approved it.</summary>
public sealed class CreateFolderFunction : ConfirmableTool<CreateFolderArgs>
{
    private readonly GraphClient _graph;

    public CreateFolderFunction(GraphClient graph) => _graph = graph;

    public override string Id => "create_folder";
    public override string DisplayName => "Create folder";
    public override string Description => "Create a folder in the user's OneDrive. The user must approve it first. If they reject it, do not retry or change it.";
    public override IReadOnlyList<string> RequiredScopes => DriveSupport.Scopes;

    protected override Task<ToolPreview> PrepareAsync(CreateFolderArgs args, ToolInvocation invocation, CancellationToken ct)
        => Task.FromResult(new ToolPreview("Create folder in OneDrive", null, [new ToolPreviewField("Path", DriveSupport.Normalise(args.Path))], AllowEdit: false));

    protected override async Task<ToolResult> CommitAsync(CreateFolderArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var path = DriveSupport.Normalise(args.Path);
        var slash = path.LastIndexOf('/');
        var parent = slash < 0 ? "me/drive/root" : $"me/drive/root:/{DriveSupport.EscapePath(path[..slash])}:";
        var name = path[(slash + 1)..];

        var body = new Dictionary<string, object>
        {
            ["name"] = name,
            ["folder"] = new { },
            ["@microsoft.graph.conflictBehavior"] = "fail"
        };

        var folder = await _graph.PostAsync(invocation.Context, $"{parent}/children", body, DriveSupport.Scopes, ct);
        return ToolResult.Ok(new { created = true, path, driveId = folder.Str("parentReference", "driveId"), itemId = folder.Str("id"), webUrl = folder.Str("webUrl") }, $"Created {path}.");
    }
}
