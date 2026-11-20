using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record CreateMailDraftArgs(
    [property: Description("Recipient email addresses. Ignored for a reply draft.")]
    List<string>? To,
    [property: Description("Cc email addresses. Ignored for a reply draft.")]
    List<string>? Cc,
    [property: Description("Subject line. Ignored for a reply draft.")]
    string? Subject,
    [property: Description("The body, as plain text or HTML according to format.")]
    string Body,
    [property: Description("Message id to reply to. Makes the draft a reply to the sender.")]
    string? ReplyToMessageId,
    [property: Description("Format of the body: text or html. Defaults to text.")]
    MailBodyFormat? Format);

/// <summary>Saves an email in Drafts after the user has approved it. Nothing is sent.</summary>
public sealed class CreateMailDraftFunction : ConfirmableTool<CreateMailDraftArgs>
{
    private readonly GraphClient _graph;

    public CreateMailDraftFunction(GraphClient graph) => _graph = graph;

    public override string Id => "create_mail_draft";
    public override string DisplayName => "Create email draft";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Save an email in the user's Drafts folder without sending it, either new or as a reply. The user must approve it first. If they reject it, do not retry or change it. Get people's email addresses and ids from find_people; never build an email address from a name.";
    public override IReadOnlyList<string> RequiredScopes => MailSupport.WriteScopes;

    protected override Task<ToolPreview> PrepareAsync(CreateMailDraftArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var (to, cc) = Validate(args);
        var fields = new List<ToolPreviewField>();
        if (IsReply(args))
        {
            fields.Add(new ToolPreviewField("Reply to message", args.ReplyToMessageId!));
        }
        else
        {
            fields.Add(new ToolPreviewField("To", string.Join(", ", to), Role: ToolPreviewFieldRole.Recipients));
            if (cc.Count > 0)
            {
                fields.Add(new ToolPreviewField("Cc", string.Join(", ", cc), Role: ToolPreviewFieldRole.Recipients));
            }

            fields.Add(new ToolPreviewField("Subject", args.Subject ?? "", Role: ToolPreviewFieldRole.Subject));
        }

        fields.Add(new ToolPreviewField("Message", args.Body, Multiline: true, Role: ToolPreviewFieldRole.Body, Html: args.Format == MailBodyFormat.Html));
        return Task.FromResult(new ToolPreview("Save email draft", "The draft is saved in Drafts and not sent.", fields, AllowEdit: false, Kind: ToolPreviewKind.Message));
    }

    protected override async Task<ToolResult> CommitAsync(CreateMailDraftArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var (to, cc) = Validate(args);

        JsonElement draft;
        if (IsReply(args) && args.Format == MailBodyFormat.Html)
        {
            draft = await MailSupport.CreateHtmlReplyDraftAsync(_graph, invocation.Context, args.ReplyToMessageId!, "createReply", args.Body, [], ct);
        }
        else if (IsReply(args))
        {
            draft = await _graph.PostAsync(invocation.Context,
                $"me/messages/{Uri.EscapeDataString(args.ReplyToMessageId!.Trim())}/createReply",
                new { comment = args.Body }, MailSupport.WriteScopes, ct);
        }
        else
        {
            draft = await _graph.PostAsync(invocation.Context, "me/messages", new
            {
                subject = args.Subject ?? "",
                body = new { contentType = MailSupport.ContentType(args.Format), content = args.Body },
                toRecipients = MailSupport.Recipients(to),
                ccRecipients = MailSupport.Recipients(cc)
            }, MailSupport.WriteScopes, ct);
        }

        return ToolResult.Ok(new { saved = true, messageId = draft.Str("id"), webLink = draft.Str("webLink") }, "Draft saved.");
    }

    private static bool IsReply(CreateMailDraftArgs args) => !string.IsNullOrWhiteSpace(args.ReplyToMessageId);

    private static (List<string> To, List<string> Cc) Validate(CreateMailDraftArgs args)
    {
        if (MailSupport.IsBlank(args.Body, args.Format))
        {
            throw new ToolArgumentException("body must not be empty.");
        }

        return (MailSupport.Addresses(args.To), MailSupport.Addresses(args.Cc));
    }
}
