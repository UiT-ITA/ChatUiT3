using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public enum MailReplyMode
{
    Reply,
    ReplyAll,
    Forward
}

public sealed record ReplyToMailArgs(
    [property: Description("Message id from search_mail or get_mail.")]
    string MessageId,
    MailReplyMode Mode,
    [property: Description("Plain-text message placed above the original email.")]
    string Text,
    [property: Description("Recipient email addresses. Required for forward, ignored otherwise.")]
    List<string>? To);

/// <summary>Replies to, replies all to or forwards an email after the user has approved it.</summary>
public sealed class ReplyToMailFunction : ConfirmableTool<ReplyToMailArgs>
{
    private readonly GraphClient _graph;

    public ReplyToMailFunction(GraphClient graph) => _graph = graph;

    public override string Id => "reply_to_mail";
    public override string DisplayName => "Reply to email";
    public override string Description => "Reply, reply all or forward an email from the user's mailbox. The user must approve it first.";
    public override IReadOnlyList<string> RequiredScopes => MailSupport.SendScopes;

    protected override async Task<ToolPreview> PrepareAsync(ReplyToMailArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var to = Validate(args);
        var original = await _graph.GetAsync(invocation.Context,
            $"me/messages/{Uri.EscapeDataString(args.MessageId.Trim())}?$select=subject,from,toRecipients,ccRecipients",
            MailSupport.SendScopes, ct);

        var from = original.TryGetProperty("from", out var f) ? MailSupport.Person(f) : "";
        var recipients = args.Mode switch
        {
            MailReplyMode.Forward => string.Join(", ", to),
            MailReplyMode.ReplyAll => string.Join(", ", new[] { from }.Concat(MailSupport.People(original, "toRecipients")).Concat(MailSupport.People(original, "ccRecipients")).Distinct()),
            _ => from
        };

        var title = args.Mode switch { MailReplyMode.Forward => "Forward email", MailReplyMode.ReplyAll => "Reply all", _ => "Reply to email" };
        return new ToolPreview(
            title,
            null,
            [new ToolPreviewField("To", recipients), new ToolPreviewField("Subject", original.Str("subject") ?? ""), new ToolPreviewField("Message", args.Text, Multiline: true)],
            AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(ReplyToMailArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var to = Validate(args);
        var action = args.Mode switch { MailReplyMode.Forward => "forward", MailReplyMode.ReplyAll => "replyAll", _ => "reply" };
        object body = args.Mode == MailReplyMode.Forward
            ? new { comment = args.Text, toRecipients = MailSupport.Recipients(to) }
            : new { comment = args.Text };

        await _graph.PostAsync(invocation.Context, $"me/messages/{Uri.EscapeDataString(args.MessageId.Trim())}/{action}", body, MailSupport.SendScopes, ct);
        return ToolResult.Ok(new { sent = true, mode = action }, "Email sent.");
    }

    private static List<string> Validate(ReplyToMailArgs args)
    {
        if (string.IsNullOrWhiteSpace(args.MessageId) || string.IsNullOrWhiteSpace(args.Text))
        {
            throw new ToolArgumentException("messageId and text are required.");
        }

        var to = MailSupport.Addresses(args.To);
        if (args.Mode == MailReplyMode.Forward && to.Count == 0)
        {
            throw new ToolArgumentException("to is required when forwarding.");
        }

        return to;
    }
}
