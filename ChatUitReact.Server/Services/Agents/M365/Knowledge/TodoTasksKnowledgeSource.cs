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

/// <summary>Open tasks in all of the user's Microsoft To Do lists, grouped by list.</summary>
public sealed class TodoTasksKnowledgeSource : IKnowledgeSource
{
    private const int MaxTasks = 100;
    private readonly GraphClient _graph;

    public TodoTasksKnowledgeSource(GraphClient graph) => _graph = graph;

    public string Id => "m365_todo_tasks";
    public string DisplayName => "To Do tasks";
    public string Description => "Open tasks in all your Microsoft To Do lists, with or without a due date.";
    public string Group => M365Knowledge.Group;
    public ToolAccessPolicy DefaultPolicy => ToolAccessPolicy.Everyone;
    public IReadOnlyList<string> RequiredScopes => TaskSupport.Scopes;

    private sealed record TodoList(string Name, List<JsonElement> Tasks, bool HasMore);

    public async Task<string?> LoadAsync(KnowledgeSourceContext context, CancellationToken ct)
    {
        var lists = (await _graph.GetAsync(context.Run, "me/todo/lists", TaskSupport.Scopes, ct)).Items().ToList();
        var loaded = await M365Knowledge.MapLimitedAsync(lists, list => LoadListAsync(context, list, ct), ct);

        var total = loaded.Sum(l => l.Tasks.Count);
        if (total == 0)
        {
            return "No open To Do tasks.";
        }

        var text = new StringBuilder($"{total} open To Do tasks, by list.");
        if (total > MaxTasks || loaded.Any(l => l.HasMore))
        {
            text.Append($" Only the first {Math.Min(total, MaxTasks)} are listed.");
        }

        var remaining = MaxTasks;
        foreach (var list in loaded.Where(l => l.Tasks.Count > 0))
        {
            if (remaining == 0)
            {
                break;
            }

            text.Append($"\n\n### {list.Name}");
            foreach (var task in list.Tasks.Take(remaining))
            {
                text.Append("\n- ").Append(Line(context, task));
            }

            remaining -= Math.Min(remaining, list.Tasks.Count);
        }

        return text.ToString();
    }

    private async Task<TodoList> LoadListAsync(KnowledgeSourceContext context, JsonElement list, CancellationToken ct)
    {
        var response = await _graph.GetAsync(context.Run,
            $"{TaskSupport.TodoTasksPath(list.Str("id")!)}?$filter=status ne 'completed'&$top={MaxTasks}",
            TaskSupport.Scopes, ct);

        var tasks = response.Items()
            .OrderBy(t => t.Str("dueDateTime", "dateTime") == null)
            .ThenBy(t => t.Str("dueDateTime", "dateTime"), StringComparer.Ordinal)
            .ToList();
        return new TodoList(list.Str("displayName") ?? "List", tasks, M365Knowledge.HasMore(response));
    }

    private static string Line(KnowledgeSourceContext context, JsonElement task)
    {
        var parts = new List<string> { M365Knowledge.Clip(task.Str("title") ?? "(no title)") };

        parts.Add(M365Knowledge.Date(context, task.Str("dueDateTime", "dateTime"), task.Str("dueDateTime", "timeZone")) is { } due
            ? $"Due: {due}"
            : "No due date");

        if (task.Str("importance") == "high")
        {
            parts.Add("High importance");
        }

        if (task.Str("status") is { } status && status != "notStarted")
        {
            parts.Add(status);
        }

        return string.Join(" | ", parts);
    }
}
