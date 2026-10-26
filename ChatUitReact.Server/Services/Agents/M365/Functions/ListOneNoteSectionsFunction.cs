using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record ListOneNoteSectionsArgs(
    [property: Description("Notebook id from list_onenote_notebooks.")]
    string NotebookId);

public sealed class ListOneNoteSectionsFunction : Tool<ListOneNoteSectionsArgs>
{
    private readonly GraphClient _graph;

    public ListOneNoteSectionsFunction(GraphClient graph) => _graph = graph;

    public override string Id => "list_onenote_sections";
    public override string DisplayName => "List OneNote sections";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "List the sections in a OneNote notebook, with ids.";
    public override IReadOnlyList<string> RequiredScopes => OneNoteSupport.ReadScopes;

    protected override async Task<ToolResult> ExecuteAsync(ListOneNoteSectionsArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var (root, onenote, notebookId) = OneNoteSupport.Split(args.NotebookId, "notebookId");
        var response = await _graph.GetAsync(invocation.Context,
            $"{onenote}/notebooks/{notebookId}/sections?$select=id,displayName,lastModifiedDateTime",
            OneNoteSupport.ReadScopes, ct);

        var sections = response.Items().Select(s => new { id = OneNoteSupport.Id(root, s.Str("id")!), name = s.Str("displayName"), lastModified = s.Str("lastModifiedDateTime") }).ToList();
        return ToolResult.Ok(new { notebookId = args.NotebookId, count = sections.Count, sections });
    }
}
