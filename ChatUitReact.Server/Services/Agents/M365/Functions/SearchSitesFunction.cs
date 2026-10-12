using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record SearchSitesArgs(
    [property: Description("Words in the site name.")]
    string Query);

public sealed class SearchSitesFunction : Tool<SearchSitesArgs>
{
    public static readonly string[] Scopes = [M365Scopes.SitesReadAll];
    private readonly GraphClient _graph;

    public SearchSitesFunction(GraphClient graph) => _graph = graph;

    public override string Id => "search_sites";
    public override string DisplayName => "Search SharePoint sites";
    public override string Description => "Find SharePoint sites by name. Returns site id, name, description and link.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(SearchSitesArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(args.Query))
        {
            return ToolResult.Error("query is required.");
        }

        var response = await _graph.GetAsync(invocation.Context,
            $"sites?search={Uri.EscapeDataString(args.Query.Trim())}&$top=25&$select=id,displayName,description,webUrl",
            Scopes, ct);

        var sites = response.Items().Select(s => new
        {
            id = s.Str("id"),
            name = s.Str("displayName"),
            description = s.Str("description"),
            webUrl = s.Str("webUrl")
        }).ToList();

        return ToolResult.Ok(new { count = sites.Count, sites });
    }
}
