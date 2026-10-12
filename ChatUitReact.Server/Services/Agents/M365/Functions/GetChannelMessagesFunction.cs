using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record GetChannelMessagesArgs(
    [property: Description("Team id from list_teams.")]
    string TeamId,
    [property: Description("Channel id from list_channels.")]
    string ChannelId,
    [property: Description("How many of the newest posts to return, 1 to 50. Defaults to 10.")]
    int? Top);

public sealed class GetChannelMessagesFunction : Tool<GetChannelMessagesArgs>
{
    private static readonly string[] Scopes = [M365Scopes.ChannelMessageReadAll];
    private readonly GraphClient _graph;

    public GetChannelMessagesFunction(GraphClient graph) => _graph = graph;

    public override string Id => "get_channel_messages";
    public override string DisplayName => "Read Teams channel";
    public override string Description => "Read the newest posts in a Teams channel with their replies: sender, time and plain-text body.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(GetChannelMessagesArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(args.TeamId) || string.IsNullOrWhiteSpace(args.ChannelId))
        {
            return ToolResult.Error("teamId and channelId are required.");
        }

        var top = Math.Clamp(args.Top ?? 10, 1, 50);
        var response = await _graph.GetAsync(invocation.Context,
            $"teams/{Uri.EscapeDataString(args.TeamId.Trim())}/channels/{Uri.EscapeDataString(args.ChannelId.Trim())}/messages?$top={top}&$expand=replies",
            Scopes, ct);

        var posts = response.Items()
            .Where(m => m.Str("messageType") == "message")
            .Select(m => new
            {
                post = TeamsChatSupport.ToMessage(m),
                subject = m.Str("subject"),
                replies = m.Items("replies").Where(r => r.Str("messageType") == "message").OrderBy(r => r.Str("createdDateTime")).Select(TeamsChatSupport.ToMessage).ToList()
            }).ToList();

        return ToolResult.Ok(new { teamId = args.TeamId, channelId = args.ChannelId, count = posts.Count, posts });
    }
}
