using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

/// <summary>Shared Graph calls for the Teams write functions.</summary>
internal static class TeamsChatSupport
{
    public static readonly string[] SendScopes = [M365Scopes.ChatCreate, M365Scopes.ChatMessageSend, M365Scopes.UserRead, M365Scopes.UserReadBasicAll];

    public sealed record Person(string Id, string DisplayName, string? Email);

    public static async Task<Person> ResolveAsync(GraphClient graph, ToolExecutionContext context, string idOrEmail, CancellationToken ct)
    {
        var user = await graph.GetAsync(context, $"users/{Uri.EscapeDataString(idOrEmail.Trim())}?$select=id,displayName,mail,userPrincipalName", SendScopes, ct);
        return new Person(user.Str("id")!, user.Str("displayName") ?? idOrEmail, user.Str("mail") ?? user.Str("userPrincipalName"));
    }

    public static async Task<Person> MeAsync(GraphClient graph, ToolExecutionContext context, CancellationToken ct)
    {
        var me = await graph.GetAsync(context, "me?$select=id,displayName,mail,userPrincipalName", SendScopes, ct);
        return new Person(me.Str("id")!, me.Str("displayName") ?? "me", me.Str("mail") ?? me.Str("userPrincipalName"));
    }

    public static object Member(string userId) => new Dictionary<string, object>
    {
        ["@odata.type"] = "#microsoft.graph.aadUserConversationMember",
        ["roles"] = new[] { "owner" },
        ["user@odata.bind"] = $"https://graph.microsoft.com/v1.0/users('{userId}')"
    };

    public static async Task<JsonElement> CreateChatAsync(GraphClient graph, ToolExecutionContext context, string chatType, IEnumerable<string> userIds, string? topic, CancellationToken ct)
    {
        var body = new Dictionary<string, object>
        {
            ["chatType"] = chatType,
            ["members"] = userIds.Distinct(StringComparer.OrdinalIgnoreCase).Select(Member).ToList()
        };
        if (!string.IsNullOrWhiteSpace(topic))
        {
            body["topic"] = topic.Trim();
        }

        return await graph.PostAsync(context, "chats", body, SendScopes, ct);
    }

    public static Task<JsonElement> SendAsync(GraphClient graph, ToolExecutionContext context, string chatId, string text, CancellationToken ct)
        => graph.PostAsync(context, $"chats/{Uri.EscapeDataString(chatId)}/messages", new { body = new { contentType = "text", content = text } }, SendScopes, ct);

    public static async Task<string> DescribeChatAsync(GraphClient graph, ToolExecutionContext context, string chatId, CancellationToken ct)
    {
        var chat = await graph.GetAsync(context, $"me/chats/{Uri.EscapeDataString(chatId)}?$expand=members($select=displayName)", [M365Scopes.ChatReadBasic], ct);
        var members = chat.Items("members").Select(m => m.Str("displayName")).Where(n => n != null).ToList();
        var topic = chat.Str("topic");
        return string.IsNullOrWhiteSpace(topic) ? string.Join(", ", members) : $"{topic} ({string.Join(", ", members)})";
    }
}
