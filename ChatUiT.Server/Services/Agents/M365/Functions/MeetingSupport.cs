using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

/// <summary>Resolves a Teams join link, or a meeting chat, to the online meeting that transcripts and attendance hang off.</summary>
internal static class MeetingSupport
{
    public const string JoinUrlDescription = "Teams join link (joinUrl) from get_calendar_view or get_event. Give this or chatId.";

    public const string ChatIdDescription = "The id of the meeting's chat, from the Teams meeting context. Give this or joinUrl.";

    /// <summary>The scopes of reading a meeting chat's join link.</summary>
    public static readonly string[] ChatScopes = [M365Scopes.ChatReadBasic];

    public static async Task<string> FindMeetingIdAsync(GraphClient graph, ToolExecutionContext context, string? joinUrl, string? chatId, string[] scopes, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(joinUrl) && !string.IsNullOrWhiteSpace(chatId))
        {
            joinUrl = await JoinUrlOfChatAsync(graph, context, chatId, ct);
        }
        if (string.IsNullOrWhiteSpace(joinUrl))
        {
            throw new ToolArgumentException("joinUrl or chatId is required.");
        }

        var filter = Uri.EscapeDataString($"JoinWebUrl eq '{joinUrl.Trim().Replace("'", "''")}'");
        var response = await graph.GetAsync(context, $"me/onlineMeetings?$filter={filter}&$select=id", scopes, ct);

        return response.Items().Select(m => m.Str("id")).FirstOrDefault(id => id != null)
            ?? throw new ToolArgumentException("No Teams meeting was found for this join link.");
    }

    /// <summary>The join link of the meeting the chat belongs to.</summary>
    private static async Task<string> JoinUrlOfChatAsync(GraphClient graph, ToolExecutionContext context, string chatId, CancellationToken ct)
    {
        var chat = await graph.GetAsync(context, $"me/chats/{Uri.EscapeDataString(chatId.Trim())}", ChatScopes, ct);
        return chat.Str("onlineMeetingInfo", "joinWebUrl")
            ?? throw new ToolArgumentException("This chat belongs to no Teams meeting.");
    }
}
