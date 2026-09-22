using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record SearchFilesArgs(
    [property: Description("Search terms. Matches file names and content across the user's OneDrive and SharePoint sites they can access.")]
    string Query,
    [property: Description("How many results to return, 1 to 25. Defaults to 10.")]
    int? Top);

public sealed class SearchFilesFunction : Tool<SearchFilesArgs>
{
    private static readonly string[] Scopes = [M365Scopes.FilesReadWriteAll];
    private readonly GraphClient _graph;

    public SearchFilesFunction(GraphClient graph) => _graph = graph;

    public override string Id => "search_files";
    public override string DisplayName => "Search files";
    public override string Description => "Search files the user can access in OneDrive and SharePoint by name or content. Returns name, driveId, itemId, last modified, size and a web link. Use driveId and itemId with read_file.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(SearchFilesArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var query = args.Query.Trim();
        if (query.Length == 0)
        {
            return ToolResult.Error("query must not be empty.");
        }

        var size = Math.Clamp(args.Top ?? 10, 1, 25);
        var body = new
        {
            requests = new[]
            {
                new { entityTypes = new[] { "driveItem" }, query = new { queryString = query }, from = 0, size }
            }
        };

        var response = await _graph.PostAsync(invocation.Context, "search/query", body, Scopes, ct);

        var hits = response.Items()
            .SelectMany(v => v.Items("hitsContainers"))
            .SelectMany(c => c.Items("hits"))
            .Select(h => h.TryGetProperty("resource", out var r) ? r : default)
            .Where(r => r.ValueKind == System.Text.Json.JsonValueKind.Object)
            .Select(r => new
            {
                name = r.Str("name"),
                driveId = r.Str("parentReference", "driveId"),
                itemId = r.Str("id"),
                lastModified = r.Str("lastModifiedDateTime"),
                lastModifiedBy = r.Str("lastModifiedBy", "user", "displayName"),
                size = r.Str("size"),
                isFolder = r.ValueKind == System.Text.Json.JsonValueKind.Object && r.TryGetProperty("folder", out _),
                webUrl = r.Str("webUrl")
            }).ToList();

        return ToolResult.Ok(new { query, count = hits.Count, files = hits });
    }
}
