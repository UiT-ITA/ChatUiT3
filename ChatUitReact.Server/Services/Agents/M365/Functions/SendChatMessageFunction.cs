using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record SendChatMessageArgs(
    [property: Description("The plain-text message to send.")]
    string Text,
    [property: Description("Id of an existing chat (from list_chats). Provide this or userIdOrEmail, not both.")]
    string? ChatId,
    [property: Description("Id or email of one person to message directly. A one-on-one chat is created if none exists.")]
    string? UserIdOrEmail);

/// <summary>Sends a Teams chat message after the user has approved the recipient and text.</summary>
public sealed class SendChatMessageFunction : ConfirmableTool<SendChatMessageArgs>
{
    private readonly GraphClient _graph;

    public SendChatMessageFunction(GraphClient graph) => _graph = graph;

    public override string Id => "send_chat_message";
    public override string DisplayName => "Send Teams message";
    public override string Description => "Send a Teams chat message to one person (by id or email) or into an existing chat (by chat id). The user must approve it first. If they reject it, do not retry or change it. Get people's email addresses and ids from find_people; never build an email address from a name.";
    public override IReadOnlyList<string> RequiredScopes => TeamsChatSupport.SendScopes;

    protected override async Task<ToolPreview> PrepareAsync(SendChatMessageArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        Validate(args);

        string recipient;
        if (!string.IsNullOrWhiteSpace(args.UserIdOrEmail))
        {
            var person = await TeamsChatSupport.ResolveAsync(_graph, invocation.Context, args.UserIdOrEmail, ct);
            recipient = person.Email == null ? person.DisplayName : $"{person.DisplayName} ({person.Email})";
        }
        else
        {
            recipient = await TeamsChatSupport.DescribeChatAsync(_graph, invocation.Context, args.ChatId!, ct);
        }

        return new ToolPreview(
            "Send Teams message",
            null,
            [new ToolPreviewField("To", recipient), new ToolPreviewField("Message", args.Text, Multiline: true)],
            AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(SendChatMessageArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var chatId = args.ChatId?.Trim();
        if (string.IsNullOrWhiteSpace(chatId))
        {
            var me = await TeamsChatSupport.MeAsync(_graph, invocation.Context, ct);
            var other = await TeamsChatSupport.ResolveAsync(_graph, invocation.Context, args.UserIdOrEmail!, ct);
            var chat = await TeamsChatSupport.CreateChatAsync(_graph, invocation.Context, "oneOnOne", [me.Id, other.Id], null, ct);
            chatId = chat.Str("id")!;
        }

        var sent = await TeamsChatSupport.SendAsync(_graph, invocation.Context, chatId, args.Text, ct);
        return ToolResult.Ok(new { sent = true, chatId, messageId = sent.Str("id"), at = sent.Str("createdDateTime") }, "Message sent.");
    }

    private static void Validate(SendChatMessageArgs args)
    {
        if (string.IsNullOrWhiteSpace(args.Text))
        {
            throw new ToolArgumentException("text must not be empty.");
        }

        var hasChat = !string.IsNullOrWhiteSpace(args.ChatId);
        var hasUser = !string.IsNullOrWhiteSpace(args.UserIdOrEmail);
        if (hasChat == hasUser)
        {
            throw new ToolArgumentException("Provide exactly one of chatId or userIdOrEmail.");
        }
    }
}
