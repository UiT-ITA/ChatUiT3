using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Agents.M365.Functions;
using ChatUitReact.Server.Services.Knowledge;

namespace ChatUitReact.Server.Services.Agents.M365.Knowledge;

/// <summary>Open Planner tasks assigned to the user, with their plan, due date and progress.</summary>
public sealed class PlannerTasksKnowledgeSource : IKnowledgeSource
{
    private const int MaxTasks = 100;
    private readonly GraphClient _graph;

    public PlannerTasksKnowledgeSource(GraphClient graph) => _graph = graph;

    public string Id => "m365_planner_tasks";
    public string DisplayName => "Planner tasks";
    public string Description => "Open Planner tasks assigned to you, with or without a due date.";
    public string Group => M365Knowledge.Group;
    public ToolAccessPolicy DefaultPolicy => ToolAccessPolicy.Everyone;
    public IReadOnlyList<string> RequiredScopes => TaskSupport.Scopes;

    public async Task<string?> LoadAsync(KnowledgeSourceContext context, CancellationToken ct)
    {
        var response = await _graph.GetAsync(context.Run, "me/planner/tasks", TaskSupport.Scopes, ct);
        var open = response.Items()
            .Where(t => t.Str("percentComplete") != "100")
            .OrderBy(t => t.Str("dueDateTime") == null)
            .ThenBy(t => t.Str("dueDateTime"), StringComparer.Ordinal)
            .ToList();

        if (open.Count == 0)
        {
            return "No open Planner tasks are assigned to you.";
        }

        var listed = open.Take(MaxTasks).ToList();
        var planIds = listed.Select(t => t.Str("planId")).OfType<string>().Distinct().ToList();
        var planTitles = await M365Knowledge.MapLimitedAsync(planIds, id => PlanTitleAsync(context, id, ct), ct);
        var plans = planIds.Zip(planTitles).ToDictionary(p => p.First, p => p.Second);

        var text = new StringBuilder($"{open.Count} open Planner tasks assigned to you, by due date.");
        if (open.Count > MaxTasks || M365Knowledge.HasMore(response))
        {
            text.Append($" Only the first {listed.Count} are listed.");
        }

        foreach (var task in listed)
        {
            text.Append("\n- ").Append(Line(context, task, plans));
        }

        return text.ToString();
    }

    private async Task<string> PlanTitleAsync(KnowledgeSourceContext context, string planId, CancellationToken ct)
    {
        try
        {
            var plan = await _graph.GetAsync(context.Run, $"planner/plans/{Uri.EscapeDataString(planId)}?$select=title", TaskSupport.Scopes, ct);
            return plan.Str("title") ?? "Unknown plan";
        }
        catch (GraphRequestException)
        {
            return "Unknown plan";
        }
    }

    private static string Line(KnowledgeSourceContext context, JsonElement task, Dictionary<string, string> plans)
    {
        var parts = new List<string> { M365Knowledge.Clip(task.Str("title") ?? "(no title)") };

        if (task.Str("planId") is { } planId && plans.TryGetValue(planId, out var plan))
        {
            parts.Add($"Plan: {plan}");
        }

        parts.Add(M365Knowledge.Date(context, task.Str("dueDateTime"), "UTC") is { } due ? $"Due: {due}" : "No due date");
        parts.Add(task.Str("percentComplete") == "0" ? "Not started" : "In progress");
        return string.Join(" | ", parts);
    }
}
