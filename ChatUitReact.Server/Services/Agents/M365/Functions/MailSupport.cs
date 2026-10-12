using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

/// <summary>Shared scopes, request bodies and projections for the mail functions.</summary>
internal static class MailSupport
{
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
