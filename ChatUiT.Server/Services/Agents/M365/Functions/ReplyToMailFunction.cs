using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

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
    [property: Description("The message placed above the original email, as plain text or HTML according to format.")]
    string Text,
    [property: Description("Recipient email addresses. Required for forward, ignored otherwise.")]
    List<string>? To,
    [property: Description("Format of the message: text or html. Defaults to text.")]
    MailBodyFormat? Format);

/// <summary>Replies to, replies all to or forwards an email after the user has approved it.</summary>
public sealed class ReplyToMailFunction : ConfirmableTool<ReplyToMailArgs>
{
    private readonly GraphClient _graph;

    public ReplyToMailFunction(GraphClient graph) => _graph = graph;

    public override string Id => "reply_to_mail";
    public override string DisplayName => "Reply to email";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Reply, reply all or forward an email from the user's mailbox. The user must approve it first. If they reject it, do not retry or change it. Get people's email addresses and ids from find_people; never build an email address from a name.";
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
            [new ToolPreviewField("To", recipients, Role: ToolPreviewFieldRole.Recipients), new ToolPreviewField("Subject", original.Str("subject") ?? "", Role: ToolPreviewFieldRole.Subject), new ToolPreviewField("Message", args.Text, Multiline: true, Role: ToolPreviewFieldRole.Body, Html: args.Format == MailBodyFormat.Html)],
            AllowEdit: false, Kind: ToolPreviewKind.Message);
    }

    protected override async Task<ToolResult> CommitAsync(ReplyToMailArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var to = Validate(args);
        var action = args.Mode switch { MailReplyMode.Forward => "forward", MailReplyMode.ReplyAll => "replyAll", _ => "reply" };
        if (args.Format == MailBodyFormat.Html)
        {
            var createAction = args.Mode switch { MailReplyMode.Forward => "createForward", MailReplyMode.ReplyAll => "createReplyAll", _ => "createReply" };
            var draft = await MailSupport.CreateHtmlReplyDraftAsync(_graph, invocation.Context, args.MessageId, createAction, args.Text, args.Mode == MailReplyMode.Forward ? to : [], ct);
            var draftPath = $"me/messages/{Uri.EscapeDataString(draft.Str("id")!)}";
            try
            {
                await _graph.PostAsync(invocation.Context, $"{draftPath}/send", new { }, MailSupport.SendScopes, ct);
            }
            catch
            {
                await _graph.DeleteAsync(invocation.Context, draftPath, MailSupport.WriteScopes, CancellationToken.None);
                throw;
            }

            return ToolResult.Ok(new { sent = true, mode = action }, "Email sent.");
        }

        object body = args.Mode == MailReplyMode.Forward
            ? new { comment = args.Text, toRecipients = MailSupport.Recipients(to) }
            : new { comment = args.Text };

        await _graph.PostAsync(invocation.Context, $"me/messages/{Uri.EscapeDataString(args.MessageId.Trim())}/{action}", body, MailSupport.SendScopes, ct);
        return ToolResult.Ok(new { sent = true, mode = action }, "Email sent.");
    }

    private static List<string> Validate(ReplyToMailArgs args)
    {
        if (string.IsNullOrWhiteSpace(args.MessageId) || MailSupport.IsBlank(args.Text, args.Format))
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
