using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record CreateOneNoteSectionArgs(
    [property: Description("Notebook id from list_onenote_notebooks.")]
    string NotebookId,
    [property: Description("Section name.")]
    string Name);

/// <summary>Creates a section in a OneNote notebook after the user has approved it.</summary>
public sealed class CreateOneNoteSectionFunction : ConfirmableTool<CreateOneNoteSectionArgs>
{
    private readonly GraphClient _graph;

    public CreateOneNoteSectionFunction(GraphClient graph) => _graph = graph;

    public override string Id => "create_onenote_section";
    public override string DisplayName => "Create OneNote section";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Create a section in a OneNote notebook. The user must approve it first. If they reject it, do not retry or change it.";
    public override IReadOnlyList<string> RequiredScopes => OneNoteSupport.WriteScopes;

    protected override async Task<ToolPreview> PrepareAsync(CreateOneNoteSectionArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var notebook = await _graph.GetAsync(invocation.Context, $"{NotebookPath(args)}?$select=displayName", OneNoteSupport.WriteScopes, ct);
        return new ToolPreview(
            "Create OneNote section",
            null,
            [new ToolPreviewField("Notebook", notebook.Str("displayName") ?? ""), new ToolPreviewField("Section", args.Name.Trim())],
            AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(CreateOneNoteSectionArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var section = await _graph.PostAsync(invocation.Context, $"{NotebookPath(args)}/sections", new { displayName = args.Name.Trim() }, OneNoteSupport.WriteScopes, ct);
        var (root, _, _) = OneNoteSupport.Split(args.NotebookId, "notebookId");
        return ToolResult.Ok(new { created = true, sectionId = OneNoteSupport.Id(root, section.Str("id")!), name = section.Str("displayName") }, "Section created.");
    }

    private static string NotebookPath(CreateOneNoteSectionArgs args)
    {
        if (string.IsNullOrWhiteSpace(args.Name))
        {
            throw new ToolArgumentException("name is required.");
        }

        var (_, onenote, notebookId) = OneNoteSupport.Split(args.NotebookId, "notebookId");
        return $"{onenote}/notebooks/{notebookId}";
    }
}
