using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record CreateMailDraftArgs(
    [property: Description("Recipient email addresses. Ignored for a reply draft.")]
    List<string>? To,
    [property: Description("Cc email addresses. Ignored for a reply draft.")]
    List<string>? Cc,
    [property: Description("Subject line. Ignored for a reply draft.")]
    string? Subject,
    [property: Description("Plain-text body.")]
    string Body,
    [property: Description("Message id to reply to. Makes the draft a reply to the sender.")]
    string? ReplyToMessageId);

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
            fields.Add(new ToolPreviewField("To", string.Join(", ", to)));
            if (cc.Count > 0)
            {
                fields.Add(new ToolPreviewField("Cc", string.Join(", ", cc)));
            }

            fields.Add(new ToolPreviewField("Subject", args.Subject ?? ""));
        }

        fields.Add(new ToolPreviewField("Message", args.Body, Multiline: true));
        return Task.FromResult(new ToolPreview("Save email draft", "The draft is saved in Drafts and not sent.", fields, AllowEdit: false));
    }

    protected override async Task<ToolResult> CommitAsync(CreateMailDraftArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var (to, cc) = Validate(args);

        JsonElement draft;
        if (IsReply(args))
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
                body = new { contentType = "Text", content = args.Body },
                toRecipients = MailSupport.Recipients(to),
                ccRecipients = MailSupport.Recipients(cc)
            }, MailSupport.WriteScopes, ct);
        }

        return ToolResult.Ok(new { saved = true, messageId = draft.Str("id"), webLink = draft.Str("webLink") }, "Draft saved.");
    }

    private static bool IsReply(CreateMailDraftArgs args) => !string.IsNullOrWhiteSpace(args.ReplyToMessageId);

    private static (List<string> To, List<string> Cc) Validate(CreateMailDraftArgs args)
    {
        if (string.IsNullOrWhiteSpace(args.Body))
        {
            throw new ToolArgumentException("body must not be empty.");
        }

        return (MailSupport.Addresses(args.To), MailSupport.Addresses(args.Cc));
    }
}
