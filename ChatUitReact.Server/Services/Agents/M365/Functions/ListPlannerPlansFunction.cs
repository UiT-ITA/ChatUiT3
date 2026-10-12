using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record ListPlannerPlansArgs(
    [property: Description("Team id from list_teams.")]
    string TeamId);

public sealed class ListPlannerPlansFunction : Tool<ListPlannerPlansArgs>
{
    private readonly GraphClient _graph;

    public ListPlannerPlansFunction(GraphClient graph) => _graph = graph;

    public override string Id => "list_planner_plans";
    public override string DisplayName => "List Planner plans";
    public override string Description => "List the Planner plans in a team, with ids.";
    public override IReadOnlyList<string> RequiredScopes => TaskSupport.Scopes;

    protected override async Task<ToolResult> ExecuteAsync(ListPlannerPlansArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(args.TeamId))
        {
            return ToolResult.Error("teamId is required.");
        }

        var response = await _graph.GetAsync(invocation.Context, $"groups/{Uri.EscapeDataString(args.TeamId.Trim())}/planner/plans", TaskSupport.Scopes, ct);
        var plans = response.Items().Select(p => new { id = p.Str("id"), title = p.Str("title") }).ToList();

        return ToolResult.Ok(new { teamId = args.TeamId, count = plans.Count, plans });
    }
}
