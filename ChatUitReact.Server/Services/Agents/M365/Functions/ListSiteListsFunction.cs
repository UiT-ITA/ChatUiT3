using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record ListSiteListsArgs(
    [property: Description("Site id from search_sites.")]
    string SiteId);

public sealed class ListSiteListsFunction : Tool<ListSiteListsArgs>
{
    private readonly GraphClient _graph;

    public ListSiteListsFunction(GraphClient graph) => _graph = graph;

    public override string Id => "list_site_lists";
    public override string DisplayName => "List SharePoint lists";
    public override string Description => "List the lists and document libraries in a SharePoint site. Document libraries are returned with a driveId for list_folder.";
    public override IReadOnlyList<string> RequiredScopes => SearchSitesFunction.Scopes;

    protected override async Task<ToolResult> ExecuteAsync(ListSiteListsArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(args.SiteId))
        {
            return ToolResult.Error("siteId is required.");
        }

        var site = $"sites/{Uri.EscapeDataString(args.SiteId.Trim())}";
        var listsResponse = await _graph.GetAsync(invocation.Context, $"{site}/lists?$top=100&$select=id,displayName,description,list,webUrl", SearchSitesFunction.Scopes, ct);
        var drivesResponse = await _graph.GetAsync(invocation.Context, $"{site}/drives?$select=id,name,webUrl", SearchSitesFunction.Scopes, ct);

        var lists = listsResponse.Items()
            .Where(l => l.Str("list", "hidden") != "true" && l.Str("list", "template") != "documentLibrary")
            .Select(l => new { id = l.Str("id"), name = l.Str("displayName"), description = l.Str("description"), webUrl = l.Str("webUrl") })
            .ToList();

        var libraries = drivesResponse.Items()
            .Select(d => new { driveId = d.Str("id"), name = d.Str("name"), webUrl = d.Str("webUrl") })
            .ToList();

        return ToolResult.Ok(new { siteId = args.SiteId, lists, libraries });
    }
}
