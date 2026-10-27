using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

/// <summary>Scopes and projections shared by the To Do and Planner functions.</summary>
internal static class TaskSupport
{
    public static readonly string[] Scopes = [M365Scopes.TasksReadWrite];

    public static string TodoTasksPath(string listId)
    {
        if (string.IsNullOrWhiteSpace(listId))
        {
            throw new ToolArgumentException("listId is required.");
        }

        return $"me/todo/lists/{Uri.EscapeDataString(listId.Trim())}/tasks";
    }

    public static object TodoTask(JsonElement t) => new
    {
        id = t.Str("id"),
        title = t.Str("title"),
        status = t.Str("status"),
        importance = t.Str("importance"),
        due = t.Str("dueDateTime", "dateTime"),
        notes = t.Str("body", "content"),
        completed = t.Str("completedDateTime", "dateTime")
    };

    public static object PlannerTask(JsonElement t) => new
    {
        id = t.Str("id"),
        title = t.Str("title"),
        planId = t.Str("planId"),
        bucketId = t.Str("bucketId"),
        percentComplete = t.Str("percentComplete"),
        due = t.Str("dueDateTime"),
        assigneeIds = AssigneeIds(t)
    };

    public static List<string> AssigneeIds(JsonElement plannerTask)
        => plannerTask.TryGetProperty("assignments", out var a) && a.ValueKind == JsonValueKind.Object
            ? a.EnumerateObject().Select(p => p.Name).ToList()
            : [];

    /// <summary>The due date (time of day dropped) as "yyyy-MM-ddT00:00:00", or null when not given.</summary>
    public static string? Due(string? due)
    {
        if (string.IsNullOrWhiteSpace(due))
        {
            return null;
        }

        if (!DateTime.TryParse(due, out var parsed))
        {
            throw new ToolArgumentException("due must be an ISO 8601 date, e.g. 2026-10-20.");
        }

        return parsed.Date.ToString("s");
    }

    /// <summary>Display names for user ids, for previews. Unknown ids are shown as is.</summary>
    public static async Task<string> NamesAsync(GraphClient graph, ToolExecutionContext context, IEnumerable<string> userIds, CancellationToken ct)
    {
        var names = new List<string>();
        foreach (var id in userIds)
        {
            var user = await graph.GetAsync(context, $"users/{Uri.EscapeDataString(id)}?$select=displayName", PlannerScopes, ct);
            names.Add(user.Str("displayName") ?? id);
        }

        return names.Count == 0 ? "(none)" : string.Join(", ", names);
    }

    /// <summary>Planner assignments for the given user ids; ids in <paramref name="remove"/> are unassigned.</summary>
    public static Dictionary<string, object?> Assignments(IEnumerable<string> add, IEnumerable<string>? remove = null)
    {
        var assignments = new Dictionary<string, object?>();
        foreach (var id in remove ?? [])
        {
            assignments[id] = null;
        }

        foreach (var id in add)
        {
            assignments[id] = new Dictionary<string, object> { ["@odata.type"] = "#microsoft.graph.plannerAssignment", ["orderHint"] = " !" };
        }

        return assignments;
    }

    public static readonly string[] PlannerScopes = [M365Scopes.TasksReadWrite, M365Scopes.UserReadBasicAll];
}

public enum TaskImportance
{
    Low,
    Normal,
    High
}
