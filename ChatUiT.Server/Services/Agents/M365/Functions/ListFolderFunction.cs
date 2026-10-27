using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record ListFolderArgs(
    [property: Description("driveId of the folder (from search_files, list_folder or list_site_lists). Use with itemId.")]
    string? DriveId,
    [property: Description("itemId of the folder. Use with driveId.")]
    string? ItemId,
    [property: Description("Folder path in the user's OneDrive, e.g. Documents/Reports. Used when driveId is not given.")]
    string? Path);

public sealed class ListFolderFunction : Tool<ListFolderArgs>
{
    private readonly GraphClient _graph;

    public ListFolderFunction(GraphClient graph) => _graph = graph;

    public override string Id => "list_folder";
    public override string DisplayName => "List folder";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "List the files and folders in a OneDrive or SharePoint folder. With no arguments, lists the root of the user's OneDrive.";
    public override IReadOnlyList<string> RequiredScopes => DriveSupport.Scopes;

    protected override async Task<ToolResult> ExecuteAsync(ListFolderArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        string folder;
        if (!string.IsNullOrWhiteSpace(args.DriveId) || !string.IsNullOrWhiteSpace(args.ItemId))
        {
            folder = DriveSupport.ItemPath(args.DriveId ?? "", args.ItemId ?? "");
        }
        else if (!string.IsNullOrWhiteSpace(args.Path))
        {
            folder = $"me/drive/root:/{DriveSupport.EscapePath(DriveSupport.Normalise(args.Path))}:";
        }
        else
        {
            folder = "me/drive/root";
        }

        var response = await _graph.GetAsync(invocation.Context, $"{folder}/children?$top=200&$select={DriveSupport.ItemFields}", DriveSupport.Scopes, ct);
        var items = response.Items().Select(DriveSupport.Item).ToList();

        return ToolResult.Ok(new { count = items.Count, items });
    }
}
