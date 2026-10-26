using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record ListChatsArgs(
    [property: Description("How many chats to return, 1 to 50. Defaults to 20.")]
    int? Top);

public sealed class ListChatsFunction : Tool<ListChatsArgs>
{
    private static readonly string[] Scopes = [M365Scopes.ChatReadBasic];
    private readonly GraphClient _graph;

    public ListChatsFunction(GraphClient graph) => _graph = graph;

    public override string Id => "list_chats";
    public override string DisplayName => "List Teams chats";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "List the signed-in user's Teams chats (one-on-one, group and meeting chats) with their ids, type, topic and members. Use the chat id with get_chat_messages or send_chat_message.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(ListChatsArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var top = Math.Clamp(args.Top ?? 20, 1, 50);
        var response = await _graph.GetAsync(invocation.Context,
            $"me/chats?$top={top}&$expand=members&$select=id,topic,chatType,lastUpdatedDateTime,webUrl",
            Scopes, ct);

        var chats = response.Items().Select(c => new
        {
            id = c.Str("id"),
            type = c.Str("chatType"),
            topic = c.Str("topic"),
            lastUpdated = c.Str("lastUpdatedDateTime"),
            members = c.Items("members").Select(m => new { name = m.Str("displayName"), userId = m.Str("userId"), email = m.Str("email") }).ToList(),
            webUrl = c.Str("webUrl")
        }).ToList();

        return ToolResult.Ok(new { count = chats.Count, chats });
    }
}
