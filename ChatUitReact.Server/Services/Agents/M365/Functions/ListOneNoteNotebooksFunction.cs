using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record ListOneNoteNotebooksArgs;

/// <summary>
/// Lists the user's own notebooks plus the notebooks of others they have opened, like the OneNote start screen.
/// Graph only names the others by web link, so each is looked up in the SharePoint site (or OneDrive) behind that link.
/// </summary>
public sealed class ListOneNoteNotebooksFunction : Tool<ListOneNoteNotebooksArgs>
{
    private static readonly string[] Scopes = [.. OneNoteSupport.ReadScopes, M365Scopes.SitesReadAll];
    private static readonly string[] SiteKinds = ["personal", "sites", "teams"];
    private readonly GraphClient _graph;

    public ListOneNoteNotebooksFunction(GraphClient graph) => _graph = graph;

    public override string Id => "list_onenote_notebooks";
    public override string DisplayName => "List OneNote notebooks";
    public override string Description => "List the user's own OneNote notebooks (mine: true) and the notebooks of others they have opened (mine: false, with where they are stored), with ids.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    private sealed record Site(string? Root, string? Name, List<JsonElement> Notebooks, string? Error);

    protected override async Task<ToolResult> ExecuteAsync(ListOneNoteNotebooksArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var own = await _graph.GetAsync(invocation.Context, "me/onenote/notebooks?$select=id,displayName,lastModifiedDateTime,links", Scopes, ct);
        var notebooks = own.Items().Select(n => (object)new
        {
            id = n.Str("id"),
            name = n.Str("displayName"),
            mine = true,
            lastModified = n.Str("lastModifiedDateTime"),
            webUrl = n.Str("links", "oneNoteWebUrl", "href")
        }).ToList();

        var recent = (await _graph.GetAsync(invocation.Context, "me/onenote/notebooks/getRecentNotebooks(includePersonalNotebooks=false)", Scopes, ct)).Items().ToList();
        var sitePaths = recent.Select(r => SitePath(r.Str("links", "oneNoteWebUrl", "href"))).OfType<string>().Distinct().ToList();
        var sites = (await Task.WhenAll(sitePaths.Select(p => LoadSiteAsync(p, invocation.Context, ct))))
            .Zip(sitePaths, (site, path) => (path, site))
            .ToDictionary(s => s.path, s => s.site);

        foreach (var r in recent)
        {
            var name = r.Str("displayName");
            var webUrl = r.Str("links", "oneNoteWebUrl", "href");
            var path = SitePath(webUrl);
            var site = path == null ? null : sites[path];
            var match = site?.Notebooks.FirstOrDefault(n => string.Equals(n.Str("displayName"), name, StringComparison.OrdinalIgnoreCase));

            notebooks.Add(new
            {
                id = match is { } m && site!.Root != null ? OneNoteSupport.Id(site.Root, m.Str("id")!) : null,
                name,
                mine = false,
                storedIn = site?.Name,
                lastOpened = r.Str("lastAccessedTime"),
                webUrl,
                error = path == null ? "Unsupported notebook location." : site!.Error ?? (match == null ? "The notebook was not found in its site." : null)
            });
        }

        return ToolResult.Ok(new { count = notebooks.Count, notebooks });
    }

    /// <summary>"{host}:/{personal|sites|teams}/{name}" for a SharePoint or OneDrive URL, or null.</summary>
    private static string? SitePath(string? webUrl)
    {
        if (!Uri.TryCreate(webUrl, UriKind.Absolute, out var uri))
        {
            return null;
        }

        var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        return segments.Length >= 2 && SiteKinds.Contains(segments[0], StringComparer.OrdinalIgnoreCase)
            ? $"{uri.Host}:/{segments[0]}/{segments[1]}"
            : null;
    }

    private async Task<Site> LoadSiteAsync(string sitePath, ToolExecutionContext context, CancellationToken ct)
    {
        try
        {
            var site = await _graph.GetAsync(context, $"sites/{sitePath}?$select=id,displayName", Scopes, ct);
            var root = $"sites/{site.Str("id")}";
            var notebooks = await _graph.GetAsync(context, $"{root}/onenote/notebooks?$select=id,displayName", Scopes, ct);
            return new Site(root, site.Str("displayName"), notebooks.Items().ToList(), null);
        }
        catch (GraphRequestException ex)
        {
            return new Site(null, null, [], ex.Message);
        }
    }
}
