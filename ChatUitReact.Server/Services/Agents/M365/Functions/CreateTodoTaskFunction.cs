using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record CreateTodoTaskArgs(
    [property: Description("List id from list_todo_lists.")]
    string ListId,
    [property: Description("Task title.")]
    string Title,
    [property: Description("Due date, ISO 8601 (e.g. 2026-10-20).")]
    string? Due,
    [property: Description("Plain-text notes.")]
    string? Notes,
    TaskImportance? Importance);

/// <summary>Adds a task to a To Do list after the user has approved it.</summary>
public sealed class CreateTodoTaskFunction : ConfirmableTool<CreateTodoTaskArgs>
{
    private readonly GraphClient _graph;

    public CreateTodoTaskFunction(GraphClient graph) => _graph = graph;

    public override string Id => "create_todo_task";
    public override string DisplayName => "Create To Do task";
    public override string Description => "Add a task to a Microsoft To Do list. The user must approve it first. If they reject it, do not retry or change it.";
    public override IReadOnlyList<string> RequiredScopes => TaskSupport.Scopes;

    protected override async Task<ToolPreview> PrepareAsync(CreateTodoTaskArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var due = Validate(args);
        var list = await _graph.GetAsync(invocation.Context, $"me/todo/lists/{Uri.EscapeDataString(args.ListId.Trim())}", TaskSupport.Scopes, ct);

        var fields = new List<ToolPreviewField> { new("List", list.Str("displayName") ?? ""), new("Title", args.Title) };
        if (due != null)
        {
            fields.Add(new ToolPreviewField("Due", due[..10]));
        }

        if (args.Importance != null)
        {
            fields.Add(new ToolPreviewField("Importance", args.Importance.Value.ToString()));
        }

        if (!string.IsNullOrWhiteSpace(args.Notes))
        {
            fields.Add(new ToolPreviewField("Notes", args.Notes, Multiline: true));
        }

        return new ToolPreview("Create To Do task", null, fields, AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(CreateTodoTaskArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var due = Validate(args);
        var body = new Dictionary<string, object> { ["title"] = args.Title.Trim() };
        if (due != null)
        {
            body["dueDateTime"] = new { dateTime = due, timeZone = "UTC" };
        }

        if (!string.IsNullOrWhiteSpace(args.Notes))
        {
            body["body"] = new { content = args.Notes, contentType = "text" };
        }

        if (args.Importance != null)
        {
            body["importance"] = args.Importance.Value.ToString().ToLowerInvariant();
        }

        var task = await _graph.PostAsync(invocation.Context, TaskSupport.TodoTasksPath(args.ListId), body, TaskSupport.Scopes, ct);
        return ToolResult.Ok(new { created = true, taskId = task.Str("id") }, "Task created.");
    }

    private static string? Validate(CreateTodoTaskArgs args)
    {
        if (string.IsNullOrWhiteSpace(args.ListId) || string.IsNullOrWhiteSpace(args.Title))
        {
            throw new ToolArgumentException("listId and title are required.");
        }

        return TaskSupport.Due(args.Due);
    }
}
