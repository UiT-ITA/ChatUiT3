using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record ListOneNotePagesArgs(
    [property: Description("Section id from list_onenote_sections.")]
    string SectionId);

public sealed class ListOneNotePagesFunction : Tool<ListOneNotePagesArgs>
{
    private readonly GraphClient _graph;

    public ListOneNotePagesFunction(GraphClient graph) => _graph = graph;

    public override string Id => "list_onenote_pages";
    public override string DisplayName => "List OneNote pages";
    public override string Description => "List the pages in a OneNote section, newest first, with ids.";
    public override IReadOnlyList<string> RequiredScopes => OneNoteSupport.ReadScopes;

    protected override async Task<ToolResult> ExecuteAsync(ListOneNotePagesArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var (root, onenote, sectionId) = OneNoteSupport.Split(args.SectionId, "sectionId");
        var response = await _graph.GetAsync(invocation.Context,
            $"{onenote}/sections/{sectionId}/pages?$top=100&$orderby=lastModifiedDateTime desc&$select=id,title,lastModifiedDateTime",
            OneNoteSupport.ReadScopes, ct);

        var pages = response.Items().Select(p => new { id = OneNoteSupport.Id(root, p.Str("id")!), title = p.Str("title"), lastModified = p.Str("lastModifiedDateTime") }).ToList();
        return ToolResult.Ok(new { sectionId = args.SectionId, count = pages.Count, pages });
    }
}
