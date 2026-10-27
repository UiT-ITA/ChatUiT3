using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record ListChannelsArgs(
    [property: Description("Team id from list_teams.")]
    string TeamId);

public sealed class ListChannelsFunction : Tool<ListChannelsArgs>
{
    private static readonly string[] Scopes = [M365Scopes.ChannelReadBasicAll];
    private readonly GraphClient _graph;

    public ListChannelsFunction(GraphClient graph) => _graph = graph;

    public override string Id => "list_channels";
    public override string DisplayName => "List Teams channels";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "List the channels in a team, with ids.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(ListChannelsArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(args.TeamId))
        {
            return ToolResult.Error("teamId is required.");
        }

        var response = await _graph.GetAsync(invocation.Context,
            $"teams/{Uri.EscapeDataString(args.TeamId.Trim())}/channels?$select=id,displayName,description,membershipType,webUrl",
            Scopes, ct);

        var channels = response.Items().Select(c => new
        {
            id = c.Str("id"),
            name = c.Str("displayName"),
            description = c.Str("description"),
            type = c.Str("membershipType"),
            webUrl = c.Str("webUrl")
        }).ToList();

        return ToolResult.Ok(new { teamId = args.TeamId, count = channels.Count, channels });
    }
}
