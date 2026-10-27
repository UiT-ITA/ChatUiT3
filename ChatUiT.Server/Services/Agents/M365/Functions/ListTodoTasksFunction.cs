using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record ListTodoTasksArgs(
    [property: Description("List id from list_todo_lists.")]
    string ListId,
    [property: Description("Also return completed tasks.")]
    bool? IncludeCompleted);

public sealed class ListTodoTasksFunction : Tool<ListTodoTasksArgs>
{
    private readonly GraphClient _graph;

    public ListTodoTasksFunction(GraphClient graph) => _graph = graph;

    public override string Id => "list_todo_tasks";
    public override string DisplayName => "List To Do tasks";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "List tasks in a To Do list: title, status, importance, due date and notes. Open tasks only unless includeCompleted is set.";
    public override IReadOnlyList<string> RequiredScopes => TaskSupport.Scopes;

    protected override async Task<ToolResult> ExecuteAsync(ListTodoTasksArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var filter = args.IncludeCompleted == true ? string.Empty : $"&$filter={Uri.EscapeDataString("status ne 'completed'")}";
        var response = await _graph.GetAsync(invocation.Context,
            $"{TaskSupport.TodoTasksPath(args.ListId)}?$top=100{filter}",
            TaskSupport.Scopes, ct, preferHeader: "outlook.body-content-type=\"text\"");

        var tasks = response.Items().Select(TaskSupport.TodoTask).ToList();
        return ToolResult.Ok(new { listId = args.ListId, count = tasks.Count, tasks });
    }
}
