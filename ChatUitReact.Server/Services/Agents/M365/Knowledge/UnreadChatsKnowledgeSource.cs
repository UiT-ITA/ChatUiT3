using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Knowledge;

namespace ChatUitReact.Server.Services.Agents.M365.Knowledge;

/// <summary>
/// Messages in the user's Teams chats that arrived after the user last read the chat. A chat
/// counts as unread when its last message is newer than the chat's read marker and was not
/// sent by the user.
/// </summary>
public sealed class UnreadChatsKnowledgeSource : IKnowledgeSource
{
    private const int MaxChats = 20;
    private const int MaxMessagesPerChat = 20;
    private static readonly string[] Scopes = [M365Scopes.UserRead, M365Scopes.ChatRead];
    private readonly GraphClient _graph;

    public UnreadChatsKnowledgeSource(GraphClient graph) => _graph = graph;

    public string Id => "m365_unread_chats";
    public string DisplayName => "Unread Teams chats";
    public string Description => "Unread messages in your Teams chats.";
    public string Group => M365Knowledge.Group;
    public ToolAccessPolicy DefaultPolicy => ToolAccessPolicy.Everyone;
    public IReadOnlyList<string> RequiredScopes => Scopes;

    private sealed record UnreadChat(string Id, string? Topic, string ChatType, DateTimeOffset? LastRead);

    public async Task<string?> LoadAsync(KnowledgeSourceContext context, CancellationToken ct)
    {
        var meTask = _graph.GetAsync(context.Run, "me?$select=id", Scopes, ct);
        var chatsTask = _graph.GetAsync(context.Run,
            "me/chats?$expand=lastMessagePreview&$orderby=lastMessagePreview/createdDateTime desc&$top=50",
            Scopes, ct);
        var myId = (await meTask).Str("id");
        var chats = await chatsTask;

        var unread = chats.Items()
            .Select(chat => ToUnreadChat(chat, myId))
            .OfType<UnreadChat>()
            .ToList();

        if (unread.Count == 0)
        {
            return "No unread Teams chat messages.";
        }

        var listed = unread.Take(MaxChats).ToList();
        var threads = await M365Knowledge.MapLimitedAsync(listed, chat => LoadChatAsync(context, chat, myId, ct), ct);

        var text = new StringBuilder($"{unread.Count} Teams chats with unread messages, most recent first.");
        if (unread.Count > MaxChats)
        {
            text.Append($" Only the {MaxChats} most recent are listed.");
        }

        foreach (var thread in threads)
        {
            text.Append("\n\n").Append(thread);
        }

        return text.ToString();
    }

    private static UnreadChat? ToUnreadChat(JsonElement chat, string? myId)
    {
        if (chat.Str("viewpoint", "isHidden") == "true"
            || !chat.TryGetProperty("lastMessagePreview", out var preview)
            || preview.ValueKind != JsonValueKind.Object
            || preview.Str("isDeleted") == "true"
            || (myId != null && preview.Str("from", "user", "id") == myId))
        {
            return null;
        }

        var lastRead = M365Knowledge.Instant(chat.Str("viewpoint", "lastMessageReadDateTime"));
        var lastMessage = M365Knowledge.Instant(preview.Str("createdDateTime"));
        if (lastMessage == null || (lastRead != null && lastMessage <= lastRead))
        {
            return null;
        }

        return new UnreadChat(chat.Str("id")!, chat.Str("topic"), chat.Str("chatType") ?? "chat", lastRead);
    }

    private async Task<string> LoadChatAsync(KnowledgeSourceContext context, UnreadChat chat, string? myId, CancellationToken ct)
    {
        var chatPath = $"me/chats/{Uri.EscapeDataString(chat.Id)}";
        var messagesTask = _graph.GetAsync(context.Run, $"{chatPath}/messages?$top={MaxMessagesPerChat}", Scopes, ct);
        var name = string.IsNullOrWhiteSpace(chat.Topic)
            ? await MemberNamesAsync(context, chatPath, myId, ct)
            : chat.Topic;
        var response = await messagesTask;

        var page = response.Items().ToList();
        var messages = page
            .Where(m => m.Str("messageType") == "message")
            .Where(m => myId == null || m.Str("from", "user", "id") != myId)
            .Where(m => IsUnread(m, chat))
            .OrderBy(m => m.Str("createdDateTime"), StringComparer.Ordinal)
            .ToList();

        var text = new StringBuilder($"### {name} ({chat.ChatType})");
        // The page is newest first, so when even its oldest message is unread there may be more.
        if (M365Knowledge.HasMore(response) && page.Count > 0 && IsUnread(page[^1], chat))
        {
            text.Append($"\nOnly the newest {MaxMessagesPerChat} messages are listed.");
        }

        foreach (var message in messages)
        {
            text.Append($"\n- {M365Knowledge.Time(context, message.Str("createdDateTime"))} {M365Knowledge.Sender(message)}: {M365Knowledge.Clip(GraphJson.HtmlToText(message.Str("body", "content")))}");
        }

        return text.ToString();
    }

    private async Task<string> MemberNamesAsync(KnowledgeSourceContext context, string chatPath, string? myId, CancellationToken ct)
    {
        var chat = await _graph.GetAsync(context.Run, $"{chatPath}?$expand=members", Scopes, ct);
        var names = chat.Items("members")
            .Where(m => myId == null || m.Str("userId") != myId)
            .Select(m => m.Str("displayName"))
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .ToList();
        return names.Count == 0 ? "Chat" : $"Chat with {string.Join(", ", names)}";
    }

    private static bool IsUnread(JsonElement message, UnreadChat chat)
        => chat.LastRead == null || M365Knowledge.Instant(message.Str("createdDateTime")) > chat.LastRead;
}
