using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record UpdateTodoTaskArgs(
    [property: Description("List id from list_todo_lists.")]
    string ListId,
    [property: Description("Task id from list_todo_tasks.")]
    string TaskId,
    [property: Description("New title.")]
    string? Title,
    [property: Description("New due date, ISO 8601 (e.g. 2026-10-20).")]
    string? Due,
    [property: Description("New plain-text notes. Replaces the current notes.")]
    string? Notes,
    [property: Description("Mark completed (true) or open again (false).")]
    bool? Completed);

/// <summary>Changes a To Do task after the user has approved it.</summary>
public sealed class UpdateTodoTaskFunction : ConfirmableTool<UpdateTodoTaskArgs>
{
    private readonly GraphClient _graph;

    public UpdateTodoTaskFunction(GraphClient graph) => _graph = graph;

    public override string Id => "update_todo_task";
    public override string DisplayName => "Update To Do task";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Change or complete a To Do task. Only given fields change. The user must approve it first. If they reject it, do not retry or change it.";
    public override IReadOnlyList<string> RequiredScopes => TaskSupport.Scopes;

    protected override async Task<ToolPreview> PrepareAsync(UpdateTodoTaskArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        Changes(args);
        var task = await _graph.GetAsync(invocation.Context, TaskPath(args), TaskSupport.Scopes, ct);

        var fields = new List<ToolPreviewField> { new("Task", task.Str("title") ?? "") };
        if (!string.IsNullOrWhiteSpace(args.Title))
        {
            fields.Add(new ToolPreviewField("New title", args.Title));
        }

        if (!string.IsNullOrWhiteSpace(args.Due))
        {
            fields.Add(new ToolPreviewField("Due", TaskSupport.Due(args.Due)![..10]));
        }

        if (args.Completed != null)
        {
            fields.Add(new ToolPreviewField("Status", args.Completed.Value ? "Completed" : "Not started"));
        }

        if (args.Notes != null)
        {
            fields.Add(new ToolPreviewField("Notes", args.Notes, Multiline: true));
        }

        return new ToolPreview("Update To Do task", null, fields, AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(UpdateTodoTaskArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var task = await _graph.PatchAsync(invocation.Context, TaskPath(args), Changes(args), TaskSupport.Scopes, ct);
        return ToolResult.Ok(new { updated = true, task = TaskSupport.TodoTask(task) }, "Task updated.");
    }

    private static string TaskPath(UpdateTodoTaskArgs args)
    {
        if (string.IsNullOrWhiteSpace(args.TaskId))
        {
            throw new ToolArgumentException("taskId is required.");
        }

        return $"{TaskSupport.TodoTasksPath(args.ListId)}/{Uri.EscapeDataString(args.TaskId.Trim())}";
    }

    private static Dictionary<string, object> Changes(UpdateTodoTaskArgs args)
    {
        var changes = new Dictionary<string, object>();
        if (!string.IsNullOrWhiteSpace(args.Title))
        {
            changes["title"] = args.Title.Trim();
        }

        var due = TaskSupport.Due(args.Due);
        if (due != null)
        {
            changes["dueDateTime"] = new { dateTime = due, timeZone = "UTC" };
        }

        if (args.Notes != null)
        {
            changes["body"] = new { content = args.Notes, contentType = "text" };
        }

        if (args.Completed != null)
        {
            changes["status"] = args.Completed.Value ? "completed" : "notStarted";
        }

        if (changes.Count == 0)
        {
            throw new ToolArgumentException("Give at least one field to change.");
        }

        return changes;
    }
}
