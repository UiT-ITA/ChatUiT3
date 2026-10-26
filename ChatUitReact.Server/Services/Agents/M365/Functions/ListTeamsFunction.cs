using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record ListTeamsArgs;

public sealed class ListTeamsFunction : Tool<ListTeamsArgs>
{
    private static readonly string[] Scopes = [M365Scopes.TeamReadBasicAll];
    private readonly GraphClient _graph;

    public ListTeamsFunction(GraphClient graph) => _graph = graph;

    public override string Id => "list_teams";
    public override string DisplayName => "List Teams teams";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "List the teams the user is a member of, with ids. The team id is also the group id for Planner.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(ListTeamsArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var response = await _graph.GetAsync(invocation.Context, "me/joinedTeams", Scopes, ct);

        var teams = response.Items().Select(t => new
        {
            id = t.Str("id"),
            name = t.Str("displayName"),
            description = t.Str("description"),
            isArchived = t.Str("isArchived") == "true"
        }).ToList();

        return ToolResult.Ok(new { count = teams.Count, teams });
    }
}
