using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record ListPlannerTasksArgs(
    [property: Description("Plan id from list_planner_plans. Omit to list the tasks assigned to the user across all plans.")]
    string? PlanId);

public sealed class ListPlannerTasksFunction : Tool<ListPlannerTasksArgs>
{
    private readonly GraphClient _graph;

    public ListPlannerTasksFunction(GraphClient graph) => _graph = graph;

    public override string Id => "list_planner_tasks";
    public override string DisplayName => "List Planner tasks";
    public override string Description => "List Planner tasks in a plan, or the user's assigned tasks: title, bucket, assignee ids, due date and percent complete.";
    public override IReadOnlyList<string> RequiredScopes => TaskSupport.Scopes;

    protected override async Task<ToolResult> ExecuteAsync(ListPlannerTasksArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var path = string.IsNullOrWhiteSpace(args.PlanId)
            ? "me/planner/tasks"
            : $"planner/plans/{Uri.EscapeDataString(args.PlanId.Trim())}/tasks";

        var response = await _graph.GetAsync(invocation.Context, path, TaskSupport.Scopes, ct);
        var tasks = response.Items().Select(TaskSupport.PlannerTask).ToList();

        return ToolResult.Ok(new { count = tasks.Count, tasks });
    }
}
