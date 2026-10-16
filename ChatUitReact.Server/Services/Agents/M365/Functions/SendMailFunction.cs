using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record MailFileRef(
    [property: Description("driveId from search_files or list_folder.")]
    string DriveId,
    [property: Description("itemId from search_files or list_folder.")]
    string ItemId);

public sealed record SendMailArgs(
    [property: Description("Recipient email addresses.")]
    List<string> To,
    [property: Description("Cc email addresses.")]
    List<string>? Cc,
    [property: Description("Subject line.")]
    string Subject,
    [property: Description("Plain-text body.")]
    string Body,
    [property: Description("OneDrive or SharePoint files to attach, at most 3 MB in total.")]
    List<MailFileRef>? Attachments);

/// <summary>Sends an email from the user's mailbox after the user has approved recipients, text and attachments.</summary>
public sealed class SendMailFunction : ConfirmableTool<SendMailArgs>
{
    private const long MaxAttachmentBytes = 3 * 1024 * 1024;
    private static readonly string[] Scopes = [.. MailSupport.SendScopes, M365Scopes.FilesReadWriteAll];
    private readonly GraphClient _graph;

    public SendMailFunction(GraphClient graph) => _graph = graph;

    public override string Id => "send_mail";
    public override string DisplayName => "Send email";
    public override string Description => "Send a new email from the user's mailbox, optionally with OneDrive or SharePoint files attached. The user must approve it first. If they reject it, do not retry or change it. Get people's email addresses and ids from find_people; never build an email address from a name.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolPreview> PrepareAsync(SendMailArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var (to, cc) = Validate(args);
        var files = await DescribeAttachmentsAsync(args, invocation.Context, ct);

        var fields = new List<ToolPreviewField> { new("To", string.Join(", ", to)) };
        if (cc.Count > 0)
        {
            fields.Add(new ToolPreviewField("Cc", string.Join(", ", cc)));
        }

        fields.Add(new ToolPreviewField("Subject", args.Subject));
        fields.Add(new ToolPreviewField("Message", args.Body, Multiline: true));
        if (files.Count > 0)
        {
            fields.Add(new ToolPreviewField("Attachments", string.Join(", ", files.Select(f => f.Name))));
        }

        return new ToolPreview("Send email", null, fields, AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(SendMailArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var (to, cc) = Validate(args);
        var files = await DescribeAttachmentsAsync(args, invocation.Context, ct);

        var attachments = new List<Dictionary<string, object>>();
        foreach (var file in files)
        {
            var bytes = await _graph.GetBytesAsync(invocation.Context, $"{file.Path}/content", Scopes, MaxAttachmentBytes, ct);
            attachments.Add(new Dictionary<string, object>
            {
                ["@odata.type"] = "#microsoft.graph.fileAttachment",
                ["name"] = file.Name,
                ["contentBytes"] = Convert.ToBase64String(bytes)
            });
        }

        var message = new
        {
            subject = args.Subject,
            body = new { contentType = "Text", content = args.Body },
            toRecipients = MailSupport.Recipients(to),
            ccRecipients = MailSupport.Recipients(cc),
            attachments
        };

        await _graph.PostAsync(invocation.Context, "me/sendMail", new { message, saveToSentItems = true }, Scopes, ct);
        return ToolResult.Ok(new { sent = true, to, cc, subject = args.Subject, attachments = files.Select(f => f.Name).ToList() }, "Email sent.");
    }

    private static (List<string> To, List<string> Cc) Validate(SendMailArgs args)
    {
        var to = MailSupport.Addresses(args.To);
        if (to.Count == 0)
        {
            throw new ToolArgumentException("to must contain at least one address.");
        }

        if (string.IsNullOrWhiteSpace(args.Subject) || string.IsNullOrWhiteSpace(args.Body))
        {
            throw new ToolArgumentException("subject and body must not be empty.");
        }

        return (to, MailSupport.Addresses(args.Cc));
    }

    private sealed record AttachmentFile(string Path, string Name);

    /// <summary>Looks up each attachment's name and checks the total size before anything is sent.</summary>
    private async Task<List<AttachmentFile>> DescribeAttachmentsAsync(SendMailArgs args, ToolExecutionContext context, CancellationToken ct)
    {
        var files = new List<AttachmentFile>();
        long total = 0;
        foreach (var file in args.Attachments ?? [])
        {
            var path = DriveSupport.ItemPath(file.DriveId, file.ItemId);
            var item = await _graph.GetAsync(context, $"{path}?$select=name,size,file", Scopes, ct);
            if (!item.TryGetProperty("file", out _))
            {
                throw new ToolArgumentException($"{item.Str("name")} is not a file.");
            }

            total += long.TryParse(item.Str("size"), out var size) ? size : 0;
            files.Add(new AttachmentFile(path, item.Str("name") ?? "attachment"));
        }

        if (total > MaxAttachmentBytes)
        {
            throw new ToolArgumentException("Attachments exceed 3 MB in total. Share a link with create_sharing_link instead.");
        }

        return files;
    }
}
