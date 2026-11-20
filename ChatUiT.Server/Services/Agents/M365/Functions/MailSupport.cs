using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Text.Json;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public enum MailBodyFormat
{
    Text,
    Html
}

/// <summary>Shared scopes, request bodies and projections for the mail functions.</summary>
internal static class MailSupport
{
    private static readonly Regex BodyTag = new("<body[^>]*>", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>The Graph content type of a mail body in this format.</summary>
    public static string ContentType(MailBodyFormat? format) => format == MailBodyFormat.Html ? "HTML" : "Text";

    /// <summary>True when the body has no visible text in its format.</summary>
    public static bool IsBlank(string? body, MailBodyFormat? format)
        => format == MailBodyFormat.Html ? GraphJson.IsBlankHtml(body) : string.IsNullOrWhiteSpace(body);

    /// <summary>
    /// Creates a reply, reply-all or forward draft of a message (<paramref name="createAction"/> is createReply,
    /// createReplyAll or createForward) and puts the HTML above the draft's existing body. Deletes the draft
    /// if it cannot be completed.
    /// </summary>
    public static async Task<JsonElement> CreateHtmlReplyDraftAsync(GraphClient graph, ToolExecutionContext context, string messageId, string createAction, string html, IReadOnlyCollection<string> toRecipients, CancellationToken ct)
    {
        var draft = await graph.PostAsync(context, $"me/messages/{Uri.EscapeDataString(messageId.Trim())}/{createAction}", new { }, WriteScopes, ct);
        var draftPath = $"me/messages/{Uri.EscapeDataString(draft.Str("id")!)}";
        try
        {
            var changes = new Dictionary<string, object> { ["body"] = new { contentType = "HTML", content = InsertAbove(draft, html) } };
            if (toRecipients.Count > 0)
            {
                changes["toRecipients"] = Recipients(toRecipients);
            }

            return await graph.PatchAsync(context, draftPath, changes, WriteScopes, ct);
        }
        catch
        {
            await graph.DeleteAsync(context, draftPath, WriteScopes, CancellationToken.None);
            throw;
        }
    }

    /// <summary>The draft's body as HTML with <paramref name="html"/> placed first.</summary>
    private static string InsertAbove(JsonElement draft, string html)
    {
        var content = draft.Str("body", "content") ?? string.Empty;
        if (!string.Equals(draft.Str("body", "contentType"), "html", StringComparison.OrdinalIgnoreCase))
        {
            return string.IsNullOrWhiteSpace(content) ? html : $"{html}<br>{WebUtility.HtmlEncode(content).Replace("\r\n", "\n").Replace("\n", "<br>")}";
        }

        var match = BodyTag.Match(content);
        return match.Success ? content.Insert(match.Index + match.Length, html) : html + content;
    }

    public static readonly string[] ReadScopes = [M365Scopes.MailRead, M365Scopes.MailReadShared];
    public static readonly string[] WriteScopes = [M365Scopes.MailReadWrite];
    public static readonly string[] SendScopes = [M365Scopes.MailSend, M365Scopes.MailReadWrite];

    public const string MailboxDescription = "Email address of a shared mailbox to read instead of the user's own.";

    /// <summary>Trimmed, distinct addresses. Throws when one does not look like an email address.</summary>
    public static List<string> Addresses(IEnumerable<string>? addresses)
    {
        var list = (addresses ?? []).Where(a => !string.IsNullOrWhiteSpace(a)).Select(a => a.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var invalid = list.FirstOrDefault(a => !a.Contains('@'));
        if (invalid != null)
        {
            throw new ToolArgumentException($"'{invalid}' is not an email address. Resolve people with find_people first.");
        }

        return list;
    }

    public static List<object> Recipients(IEnumerable<string> addresses)
        => addresses.Select(a => (object)new { emailAddress = new { address = a } }).ToList();

    public static string Person(JsonElement recipient)
    {
        var name = recipient.Str("emailAddress", "name");
        var address = recipient.Str("emailAddress", "address");
        return name == null || name == address ? address ?? "" : $"{name} <{address}>";
    }

    public static List<string> People(JsonElement message, string property)
        => message.Items(property).Select(Person).ToList();

    /// <summary>One line per message in a listing.</summary>
    public static object Summary(JsonElement m) => new
    {
        id = m.Str("id"),
        subject = m.Str("subject"),
        from = m.TryGetProperty("from", out var from) ? Person(from) : null,
        received = m.Str("receivedDateTime"),
        isRead = m.Str("isRead") == "true",
        hasAttachments = m.Str("hasAttachments") == "true",
        preview = m.Str("bodyPreview")
    };

    public const string SummaryFields = "id,subject,from,receivedDateTime,isRead,hasAttachments,bodyPreview";
}
