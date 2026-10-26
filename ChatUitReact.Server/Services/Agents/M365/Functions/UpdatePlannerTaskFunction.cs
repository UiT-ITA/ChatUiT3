using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record UpdatePlannerTaskArgs(
    [property: Description("Task id from list_planner_tasks.")]
    string TaskId,
    [property: Description("New title.")]
    string? Title,
    [property: Description("Bucket id to move the task to.")]
    string? BucketId,
    [property: Description("User ids of everyone who should be assigned. Replaces the current assignees.")]
    List<string>? AssigneeIds,
    [property: Description("New due date, ISO 8601 (e.g. 2026-10-20).")]
    string? Due,
    [property: Description("0 not started, 50 in progress, 100 completed.")]
    int? PercentComplete);

/// <summary>Changes a Planner task after the user has approved it.</summary>
public sealed class UpdatePlannerTaskFunction : ConfirmableTool<UpdatePlannerTaskArgs>
{
    private readonly GraphClient _graph;

    public UpdatePlannerTaskFunction(GraphClient graph) => _graph = graph;

    public override string Id => "update_planner_task";
    public override string DisplayName => "Update Planner task";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Change, move, reassign or complete a Planner task. Only given fields change. The user must approve it first. If they reject it, do not retry or change it. Get people's email addresses and ids from find_people; never build an email address from a name.";
    public override IReadOnlyList<string> RequiredScopes => TaskSupport.PlannerScopes;

    protected override async Task<ToolPreview> PrepareAsync(UpdatePlannerTaskArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var task = await GetTaskAsync(args, invocation.Context, ct);
        Changes(args, task);

        var fields = new List<ToolPreviewField> { new("Task", task.Str("title") ?? "") };
        if (!string.IsNullOrWhiteSpace(args.Title))
        {
            fields.Add(new ToolPreviewField("New title", args.Title));
        }

        if (!string.IsNullOrWhiteSpace(args.BucketId))
        {
            var bucket = await _graph.GetAsync(invocation.Context, $"planner/buckets/{Uri.EscapeDataString(args.BucketId.Trim())}?$select=name", TaskSupport.PlannerScopes, ct);
            fields.Add(new ToolPreviewField("Move to bucket", bucket.Str("name") ?? ""));
        }

        if (args.AssigneeIds != null)
        {
            fields.Add(new ToolPreviewField("Assigned to", await TaskSupport.NamesAsync(_graph, invocation.Context, Assignees(args), ct)));
        }

        if (!string.IsNullOrWhiteSpace(args.Due))
        {
            fields.Add(new ToolPreviewField("Due", TaskSupport.Due(args.Due)![..10]));
        }

        if (args.PercentComplete != null)
        {
            fields.Add(new ToolPreviewField("Progress", $"{args.PercentComplete}%"));
        }

        return new ToolPreview("Update Planner task", null, fields, AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(UpdatePlannerTaskArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        // Planner only accepts an update that carries the task's current etag.
        var task = await GetTaskAsync(args, invocation.Context, ct);
        await _graph.PatchAsync(invocation.Context, TaskPath(args), Changes(args, task), TaskSupport.PlannerScopes, ct, ifMatch: task.Str("@odata.etag"));
        return ToolResult.Ok(new { updated = true, taskId = args.TaskId }, "Task updated.");
    }

    private Task<JsonElement> GetTaskAsync(UpdatePlannerTaskArgs args, ToolExecutionContext context, CancellationToken ct)
        => _graph.GetAsync(context, TaskPath(args), TaskSupport.PlannerScopes, ct);

    private static string TaskPath(UpdatePlannerTaskArgs args)
    {
        if (string.IsNullOrWhiteSpace(args.TaskId))
        {
            throw new ToolArgumentException("taskId is required.");
        }

        return $"planner/tasks/{Uri.EscapeDataString(args.TaskId.Trim())}";
    }

    private static List<string> Assignees(UpdatePlannerTaskArgs args)
        => (args.AssigneeIds ?? []).Where(id => !string.IsNullOrWhiteSpace(id)).Select(id => id.Trim()).Distinct().ToList();

    private static Dictionary<string, object> Changes(UpdatePlannerTaskArgs args, JsonElement task)
    {
        var changes = new Dictionary<string, object>();
        if (!string.IsNullOrWhiteSpace(args.Title))
        {
            changes["title"] = args.Title.Trim();
        }

        if (!string.IsNullOrWhiteSpace(args.BucketId))
        {
            changes["bucketId"] = args.BucketId.Trim();
        }

        if (args.AssigneeIds != null)
        {
            var wanted = Assignees(args);
            var current = TaskSupport.AssigneeIds(task);
            changes["assignments"] = TaskSupport.Assignments(wanted.Except(current), current.Except(wanted));
        }

        var due = TaskSupport.Due(args.Due);
        if (due != null)
        {
            changes["dueDateTime"] = due + "Z";
        }

        if (args.PercentComplete != null)
        {
            changes["percentComplete"] = Math.Clamp(args.PercentComplete.Value, 0, 100);
        }

        if (changes.Count == 0)
        {
            throw new ToolArgumentException("Give at least one field to change.");
        }

        return changes;
    }
}
