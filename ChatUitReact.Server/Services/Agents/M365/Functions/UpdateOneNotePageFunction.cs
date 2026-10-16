using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public enum OneNoteAction
{
    Append,
    Insert,
    Prepend,
    Replace
}

public enum OneNotePosition
{
    After,
    Before
}

public sealed record OneNoteChange(
    [property: Description("Element id from read_onenote_page, or \"body\" or \"title\".")]
    string Target,
    [property: Description("append/prepend add a child, insert adds a sibling, replace swaps the element.")]
    OneNoteAction Action,
    [property: Description("For append and insert. Defaults to after.")]
    OneNotePosition? Position,
    [property: Description("HTML to add, or the new title text.")]
    string Content);

public sealed record UpdateOneNotePageArgs(
    [property: Description("Page id from list_onenote_pages.")]
    string PageId,
    [property: Description("Changes to apply, in order.")]
    List<OneNoteChange> Changes);

/// <summary>Edits a OneNote page after the user has approved the changes.</summary>
public sealed class UpdateOneNotePageFunction : ConfirmableTool<UpdateOneNotePageArgs>
{
    private readonly GraphClient _graph;

    public UpdateOneNotePageFunction(GraphClient graph) => _graph = graph;

    public override string Id => "update_onenote_page";
    public override string DisplayName => "Update OneNote page";
    public override string Description => "Edit a OneNote page: add, insert or replace elements, or change the title. Target elements by the ids from read_onenote_page. The user must approve it first. If they reject it, do not retry or change it.";
    public override IReadOnlyList<string> RequiredScopes => OneNoteSupport.WriteScopes;

    protected override async Task<ToolPreview> PrepareAsync(UpdateOneNotePageArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var commands = Commands(args);
        var page = await _graph.GetAsync(invocation.Context, $"{PagePath(args)}?$select=title", OneNoteSupport.WriteScopes, ct);

        var fields = new List<ToolPreviewField> { new("Page", page.Str("title") ?? "") };
        fields.AddRange(commands.Select((c, i) => new ToolPreviewField(
            $"Change {i + 1}: {c["action"]} {(c.TryGetValue("position", out var p) ? p + " " : "")}{c["target"]}",
            (string)c["content"],
            Multiline: true)));

        return new ToolPreview("Update OneNote page", null, fields, AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(UpdateOneNotePageArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        await _graph.PatchAsync(invocation.Context, $"{PagePath(args)}/content", Commands(args), OneNoteSupport.WriteScopes, ct);
        return ToolResult.Ok(new { updated = true, pageId = args.PageId, changes = args.Changes.Count }, "Page updated.");
    }

    private static string PagePath(UpdateOneNotePageArgs args)
    {
        var (_, onenote, pageId) = OneNoteSupport.Split(args.PageId, "pageId");
        return $"{onenote}/pages/{pageId}";
    }

    /// <summary>The PATCH body OneNote expects: one command object per change, with lower-case action and position.</summary>
    private static List<Dictionary<string, object>> Commands(UpdateOneNotePageArgs args)
    {
        if (args.Changes is not { Count: > 0 })
        {
            throw new ToolArgumentException("changes must contain at least one change.");
        }

        return args.Changes.Select(c =>
        {
            if (string.IsNullOrWhiteSpace(c.Target))
            {
                throw new ToolArgumentException("Every change needs a target.");
            }

            var command = new Dictionary<string, object>
            {
                ["target"] = c.Target.Trim(),
                ["action"] = c.Action.ToString().ToLowerInvariant(),
                ["content"] = c.Content ?? ""
            };
            if (c.Position != null)
            {
                command["position"] = c.Position.Value.ToString().ToLowerInvariant();
            }

            return command;
        }).ToList();
    }
}
