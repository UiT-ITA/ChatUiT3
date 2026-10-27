using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record GetListItemsArgs(
    [property: Description("Site id from search_sites.")]
    string SiteId,
    [property: Description("List id from list_site_lists.")]
    string ListId,
    [property: Description("How many items to return, 1 to 200. Defaults to 50.")]
    int? Top);

public sealed class GetListItemsFunction : Tool<GetListItemsArgs>
{
    private readonly GraphClient _graph;

    public GetListItemsFunction(GraphClient graph) => _graph = graph;

    public override string Id => "get_list_items";
    public override string DisplayName => "Read SharePoint list";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Read items in a SharePoint list with their field values.";
    public override IReadOnlyList<string> RequiredScopes => SearchSitesFunction.Scopes;

    protected override async Task<ToolResult> ExecuteAsync(GetListItemsArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(args.SiteId) || string.IsNullOrWhiteSpace(args.ListId))
        {
            return ToolResult.Error("siteId and listId are required.");
        }

        var top = Math.Clamp(args.Top ?? 50, 1, 200);
        var response = await _graph.GetAsync(invocation.Context,
            $"sites/{Uri.EscapeDataString(args.SiteId.Trim())}/lists/{Uri.EscapeDataString(args.ListId.Trim())}/items?$top={top}&$expand=fields",
            SearchSitesFunction.Scopes, ct);

        var items = response.Items().Select(i => new
        {
            id = i.Str("id"),
            webUrl = i.Str("webUrl"),
            fields = Fields(i)
        }).ToList();

        return ToolResult.Ok(new { count = items.Count, items });
    }

    /// <summary>The item's own columns, without SharePoint's internal ones (names starting with "_" or "@" and system fields).</summary>
    private static Dictionary<string, JsonElement> Fields(JsonElement item)
    {
        string[] system = ["ContentType", "Edit", "LinkTitleNoMenu", "LinkTitle", "ItemChildCount", "FolderChildCount", "AppAuthorLookupId", "AppEditorLookupId", "AuthorLookupId", "EditorLookupId", "Attachments"];
        return item.TryGetProperty("fields", out var fields) && fields.ValueKind == JsonValueKind.Object
            ? fields.EnumerateObject()
                .Where(p => !p.Name.StartsWith('_') && !p.Name.StartsWith('@') && !system.Contains(p.Name))
                .ToDictionary(p => p.Name, p => p.Value.Clone())
            : [];
    }
}
