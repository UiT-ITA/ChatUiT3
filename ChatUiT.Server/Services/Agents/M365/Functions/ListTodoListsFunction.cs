using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record ListTodoListsArgs;

public sealed class ListTodoListsFunction : Tool<ListTodoListsArgs>
{
    private readonly GraphClient _graph;

    public ListTodoListsFunction(GraphClient graph) => _graph = graph;

    public override string Id => "list_todo_lists";
    public override string DisplayName => "List To Do lists";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "List the user's Microsoft To Do lists with ids. The default list has wellKnownName defaultList.";
    public override IReadOnlyList<string> RequiredScopes => TaskSupport.Scopes;

    protected override async Task<ToolResult> ExecuteAsync(ListTodoListsArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var response = await _graph.GetAsync(invocation.Context, "me/todo/lists", TaskSupport.Scopes, ct);

        var lists = response.Items().Select(l => new
        {
            id = l.Str("id"),
            name = l.Str("displayName"),
            wellKnownName = l.Str("wellknownListName"),
            isShared = l.Str("isShared") == "true"
        }).ToList();

        return ToolResult.Ok(new { count = lists.Count, lists });
    }
}
