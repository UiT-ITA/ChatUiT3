using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record GetChatMessagesArgs(
    [property: Description("The chat id from list_chats.")]
    string ChatId,
    [property: Description("How many of the newest messages to return, 1 to 50. Defaults to 20.")]
    int? Top);

public sealed class GetChatMessagesFunction : Tool<GetChatMessagesArgs>
{
    private static readonly string[] Scopes = [M365Scopes.ChatRead];
    private readonly GraphClient _graph;

    public GetChatMessagesFunction(GraphClient graph) => _graph = graph;

    public override string Id => "get_chat_messages";
    public override string DisplayName => "Read Teams chat";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Read the newest messages in one Teams chat, newest first: sender, time and plain-text body.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(GetChatMessagesArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(args.ChatId))
        {
            return ToolResult.Error("chatId is required.");
        }

        var top = Math.Clamp(args.Top ?? 20, 1, 50);
        var response = await _graph.GetAsync(invocation.Context,
            $"me/chats/{Uri.EscapeDataString(args.ChatId.Trim())}/messages?$top={top}",
            Scopes, ct);

        var messages = response.Items()
            .Where(m => m.Str("messageType") == "message")
            .Select(TeamsChatSupport.ToMessage)
            .ToList();

        return ToolResult.Ok(new { chatId = args.ChatId, count = messages.Count, messages });
    }
}
