using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record ListPlannerBucketsArgs(
    [property: Description("Plan id from list_planner_plans.")]
    string PlanId);

public sealed class ListPlannerBucketsFunction : Tool<ListPlannerBucketsArgs>
{
    private readonly GraphClient _graph;

    public ListPlannerBucketsFunction(GraphClient graph) => _graph = graph;

    public override string Id => "list_planner_buckets";
    public override string DisplayName => "List Planner buckets";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "List the buckets in a Planner plan, with ids.";
    public override IReadOnlyList<string> RequiredScopes => TaskSupport.Scopes;

    protected override async Task<ToolResult> ExecuteAsync(ListPlannerBucketsArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(args.PlanId))
        {
            return ToolResult.Error("planId is required.");
        }

        var response = await _graph.GetAsync(invocation.Context, $"planner/plans/{Uri.EscapeDataString(args.PlanId.Trim())}/buckets", TaskSupport.Scopes, ct);
        var buckets = response.Items().Select(b => new { id = b.Str("id"), name = b.Str("name") }).ToList();

        return ToolResult.Ok(new { planId = args.PlanId, count = buckets.Count, buckets });
    }
}
