using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record ReadMailAttachmentArgs(
    [property: Description("Message id from search_mail or get_mail.")]
    string MessageId,
    [property: Description("Attachment id from get_mail.")]
    string AttachmentId,
    [property: Description(MailSupport.MailboxDescription)]
    string? Mailbox);

public sealed class ReadMailAttachmentFunction : Tool<ReadMailAttachmentArgs>
{
    private const int MaxChars = 512 * 1024;
    private readonly GraphClient _graph;

    public ReadMailAttachmentFunction(GraphClient graph) => _graph = graph;

    public override string Id => "read_mail_attachment";
    public override string DisplayName => "Read email attachment";
    public override string Description => "Read a text-based email attachment (txt, md, csv, json, ...). Other types return metadata only.";
    public override IReadOnlyList<string> RequiredScopes => MailSupport.ReadScopes;

    protected override async Task<ToolResult> ExecuteAsync(ReadMailAttachmentArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(args.MessageId) || string.IsNullOrWhiteSpace(args.AttachmentId))
        {
            return ToolResult.Error("messageId and attachmentId are required.");
        }

        var attachment = await _graph.GetAsync(invocation.Context,
            $"{GraphClient.UserPath(args.Mailbox)}/messages/{Uri.EscapeDataString(args.MessageId.Trim())}/attachments/{Uri.EscapeDataString(args.AttachmentId.Trim())}",
            MailSupport.ReadScopes, ct);

        var name = attachment.Str("name");
        var contentType = attachment.Str("contentType");
        var metadata = new { name, contentType, size = attachment.Str("size") };
        var bytes = attachment.Str("contentBytes");

        if (bytes == null || !TextFiles.IsText(name, contentType))
        {
            return ToolResult.Ok(new { metadata, content = (string?)null, note = "Content is not readable as text." });
        }

        var (content, truncated) = TextFiles.Cap(Encoding.UTF8.GetString(Convert.FromBase64String(bytes)), MaxChars);
        return ToolResult.Ok(new { metadata, content, truncated });
    }
}
