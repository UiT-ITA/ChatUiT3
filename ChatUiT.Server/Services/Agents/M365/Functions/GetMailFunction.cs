using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record GetMailArgs(
    [property: Description("Message id from search_mail.")]
    string MessageId,
    [property: Description(MailSupport.MailboxDescription)]
    string? Mailbox,
    [property: Description("Return every email in the conversation, oldest first.")]
    bool? IncludeThread);

public sealed class GetMailFunction : Tool<GetMailArgs>
{
    private const int MaxBodyChars = 20_000;
    private const string Fields = "id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,conversationId,webLink";
    private const string TextBody = "outlook.body-content-type=\"text\"";

    private readonly GraphClient _graph;

    public GetMailFunction(GraphClient graph) => _graph = graph;

    public override string Id => "get_mail";
    public override string DisplayName => "Read email";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Read one email in full: sender, recipients, body as text and attachments (ids for read_mail_attachment). includeThread returns the whole conversation instead.";
    public override IReadOnlyList<string> RequiredScopes => MailSupport.ReadScopes;

    protected override async Task<ToolResult> ExecuteAsync(GetMailArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(args.MessageId))
        {
            return ToolResult.Error("messageId is required.");
        }

        var owner = GraphClient.UserPath(args.Mailbox);
        var message = await _graph.GetAsync(invocation.Context,
            $"{owner}/messages/{Uri.EscapeDataString(args.MessageId.Trim())}?$select={Fields}&$expand=attachments($select=id,name,contentType,size)",
            MailSupport.ReadScopes, ct, preferHeader: TextBody);

        if (args.IncludeThread != true)
        {
            return ToolResult.Ok(Full(message));
        }

        var filter = Uri.EscapeDataString($"conversationId eq '{message.Str("conversationId")}'");
        var thread = await _graph.GetAsync(invocation.Context,
            $"{owner}/messages?$filter={filter}&$top=50&$select={Fields}&$expand=attachments($select=id,name,contentType,size)",
            MailSupport.ReadScopes, ct, preferHeader: TextBody);

        var messages = thread.Items().OrderBy(m => m.Str("receivedDateTime")).Select(Full).ToList();
        return ToolResult.Ok(new { subject = message.Str("subject"), count = messages.Count, messages });
    }

    private static object Full(JsonElement m)
    {
        var (body, truncated) = TextFiles.Cap(m.Str("body", "content") ?? string.Empty, MaxBodyChars);
        return new
        {
            id = m.Str("id"),
            subject = m.Str("subject"),
            from = m.TryGetProperty("from", out var from) ? MailSupport.Person(from) : null,
            to = MailSupport.People(m, "toRecipients"),
            cc = MailSupport.People(m, "ccRecipients"),
            received = m.Str("receivedDateTime"),
            body,
            truncated,
            attachments = m.Items("attachments").Select(a => new { id = a.Str("id"), name = a.Str("name"), contentType = a.Str("contentType"), size = a.Str("size") }).ToList(),
            webLink = m.Str("webLink")
        };
    }
}
