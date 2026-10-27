using System;
using System.Collections.Generic;
using System.Linq;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

/// <summary>Builds event request bodies and previews for the calendar write functions.</summary>
internal static class EventSupport
{
    public static readonly string[] Scopes = [M365Scopes.CalendarsReadWrite];

    public static string EventPath(string eventId)
    {
        if (string.IsNullOrWhiteSpace(eventId))
        {
            throw new ToolArgumentException("eventId is required.");
        }

        return $"me/events/{Uri.EscapeDataString(eventId.Trim())}";
    }

    /// <summary>The event properties to send: only those given. start and end need a time zone.</summary>
    public static Dictionary<string, object> Body(string? subject, string? start, string? end, string? timeZone, List<string>? attendees, string? location, string? body, bool? teamsMeeting)
    {
        var fields = new Dictionary<string, object>();
        if (!string.IsNullOrWhiteSpace(subject))
        {
            fields["subject"] = subject.Trim();
        }

        if (start != null || end != null)
        {
            if (string.IsNullOrWhiteSpace(timeZone))
            {
                throw new ToolArgumentException("timeZone is required when start or end is given.");
            }

            if (start != null)
            {
                fields["start"] = new { dateTime = DateTimeValue(start, "start"), timeZone = timeZone.Trim() };
            }

            if (end != null)
            {
                fields["end"] = new { dateTime = DateTimeValue(end, "end"), timeZone = timeZone.Trim() };
            }
        }

        if (attendees != null)
        {
            fields["attendees"] = MailSupport.Addresses(attendees).Select(a => new { type = "required", emailAddress = new { address = a } }).ToList();
        }

        if (location != null)
        {
            fields["location"] = new { displayName = location.Trim() };
        }

        if (body != null)
        {
            fields["body"] = new { contentType = "Text", content = body };
        }

        if (teamsMeeting == true)
        {
            fields["isOnlineMeeting"] = true;
            fields["onlineMeetingProvider"] = "teamsForBusiness";
        }

        return fields;
    }

    /// <summary>Preview rows for the given event properties.</summary>
    public static List<ToolPreviewField> Preview(string? subject, string? start, string? end, string? timeZone, List<string>? attendees, string? location, string? body, bool? teamsMeeting)
    {
        var fields = new List<ToolPreviewField>();
        if (!string.IsNullOrWhiteSpace(subject))
        {
            fields.Add(new ToolPreviewField("Subject", subject));
        }

        if (start != null || end != null)
        {
            fields.Add(new ToolPreviewField("When", $"{start ?? "(unchanged)"} – {end ?? "(unchanged)"} ({timeZone})"));
        }

        if (attendees != null)
        {
            fields.Add(new ToolPreviewField("Attendees", attendees.Count == 0 ? "(none)" : string.Join(", ", MailSupport.Addresses(attendees))));
        }

        if (location != null)
        {
            fields.Add(new ToolPreviewField("Location", location));
        }

        if (teamsMeeting == true)
        {
            fields.Add(new ToolPreviewField("Teams meeting", "Yes"));
        }

        if (body != null)
        {
            fields.Add(new ToolPreviewField("Description", body, Multiline: true));
        }

        return fields;
    }

    private static string DateTimeValue(string value, string name)
        => DateTime.TryParse(value, out var parsed)
            ? parsed.ToString("s")
            : throw new ToolArgumentException($"{name} must be an ISO 8601 date-time without offset.");
}
