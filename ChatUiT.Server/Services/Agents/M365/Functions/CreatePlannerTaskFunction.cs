using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record CreatePlannerTaskArgs(
    [property: Description("Plan id from list_planner_plans.")]
    string PlanId,
    [property: Description("Task title.")]
    string Title,
    [property: Description("Bucket id from list_planner_buckets.")]
    string? BucketId,
    [property: Description("User ids (from find_people) to assign.")]
    List<string>? AssigneeIds,
    [property: Description("Due date, ISO 8601 (e.g. 2026-10-20).")]
    string? Due);

/// <summary>Creates a Planner task after the user has approved it.</summary>
public sealed class CreatePlannerTaskFunction : ConfirmableTool<CreatePlannerTaskArgs>
{
    private readonly GraphClient _graph;

    public CreatePlannerTaskFunction(GraphClient graph) => _graph = graph;

    public override string Id => "create_planner_task";
    public override string DisplayName => "Create Planner task";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Create a task in a Planner plan, optionally in a bucket, assigned to people and with a due date. The user must approve it first. If they reject it, do not retry or change it. Get people's email addresses and ids from find_people; never build an email address from a name.";
    public override IReadOnlyList<string> RequiredScopes => TaskSupport.PlannerScopes;

    protected override async Task<ToolPreview> PrepareAsync(CreatePlannerTaskArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var due = Validate(args);
        var plan = await _graph.GetAsync(invocation.Context, $"planner/plans/{Uri.EscapeDataString(args.PlanId.Trim())}?$select=title", TaskSupport.PlannerScopes, ct);

        var fields = new List<ToolPreviewField> { new("Plan", plan.Str("title") ?? ""), new("Title", args.Title) };
        if (!string.IsNullOrWhiteSpace(args.BucketId))
        {
            var bucket = await _graph.GetAsync(invocation.Context, $"planner/buckets/{Uri.EscapeDataString(args.BucketId.Trim())}?$select=name", TaskSupport.PlannerScopes, ct);
            fields.Add(new ToolPreviewField("Bucket", bucket.Str("name") ?? ""));
        }

        if (Assignees(args).Count > 0)
        {
            fields.Add(new ToolPreviewField("Assigned to", await TaskSupport.NamesAsync(_graph, invocation.Context, Assignees(args), ct)));
        }

        if (due != null)
        {
            fields.Add(new ToolPreviewField("Due", due[..10]));
        }

        return new ToolPreview("Create Planner task", null, fields, AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(CreatePlannerTaskArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var due = Validate(args);
        var body = new Dictionary<string, object> { ["planId"] = args.PlanId.Trim(), ["title"] = args.Title.Trim() };
        if (!string.IsNullOrWhiteSpace(args.BucketId))
        {
            body["bucketId"] = args.BucketId.Trim();
        }

        if (Assignees(args).Count > 0)
        {
            body["assignments"] = TaskSupport.Assignments(Assignees(args));
        }

        if (due != null)
        {
            body["dueDateTime"] = due + "Z";
        }

        var task = await _graph.PostAsync(invocation.Context, "planner/tasks", body, TaskSupport.PlannerScopes, ct);
        return ToolResult.Ok(new { created = true, task = TaskSupport.PlannerTask(task) }, "Task created.");
    }

    private static List<string> Assignees(CreatePlannerTaskArgs args)
        => (args.AssigneeIds ?? []).Where(id => !string.IsNullOrWhiteSpace(id)).Select(id => id.Trim()).Distinct().ToList();

    private static string? Validate(CreatePlannerTaskArgs args)
    {
        if (string.IsNullOrWhiteSpace(args.PlanId) || string.IsNullOrWhiteSpace(args.Title))
        {
            throw new ToolArgumentException("planId and title are required.");
        }

        return TaskSupport.Due(args.Due);
    }
}
