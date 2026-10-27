using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Knowledge;

namespace ChatUiT.Server.Services.Agents.M365.Knowledge;

/// <summary>
/// The user's calendar events for today. Times are read in UTC and converted here, so the
/// time zone never has to be expressed in a form Graph accepts.
/// </summary>
public sealed class TodayScheduleKnowledgeSource : IKnowledgeSource
{
    private static readonly string[] Scopes = [M365Scopes.CalendarsRead];
    private readonly GraphClient _graph;

    public TodayScheduleKnowledgeSource(GraphClient graph) => _graph = graph;

    public string Id => "m365_today_schedule";
    public string DisplayName => "Today's calendar";
    public string Description => "Your calendar events for today.";
    public string Group => M365Knowledge.Group;
    public ToolAccessPolicy DefaultPolicy => ToolAccessPolicy.Everyone;
    public IReadOnlyList<string> RequiredScopes => Scopes;

    public async Task<string?> LoadAsync(KnowledgeSourceContext context, CancellationToken ct)
    {
        var today = context.Today;
        var response = await _graph.GetAsync(context.Run,
            $"me/calendarView?startDateTime={M365Knowledge.Iso(context.StartOfDayUtc(today))}&endDateTime={M365Knowledge.Iso(context.StartOfDayUtc(today.AddDays(1)))}" +
            "&$top=100&$orderby=start/dateTime&$select=subject,start,end,isAllDay,location,organizer,isCancelled,showAs",
            Scopes, ct);

        // All-day events are floating dates stored as UTC midnights, so the converted window
        // would also catch yesterday's; they are matched on their date instead.
        var events = response.Items()
            .Where(e => e.Str("isAllDay") != "true" || StartDate(e) == today)
            .ToList();

        if (events.Count == 0)
        {
            return $"No events on {M365Knowledge.Day(today)}.";
        }

        var text = new StringBuilder($"Events on {M365Knowledge.Day(today)}:");
        foreach (var calendarEvent in events)
        {
            text.Append("\n- ").Append(Line(context, calendarEvent));
        }

        return text.ToString();
    }

    private static string Line(KnowledgeSourceContext context, JsonElement e)
    {
        var parts = new List<string>
        {
            e.Str("isAllDay") == "true"
                ? "All day"
                : $"{Clock(context, e.Str("start", "dateTime"))}–{Clock(context, e.Str("end", "dateTime"))}",
            M365Knowledge.Clip(e.Str("subject") ?? "(no subject)")
        };

        var location = e.Str("location", "displayName");
        if (!string.IsNullOrWhiteSpace(location))
        {
            parts.Add($"Location: {M365Knowledge.Clip(location)}");
        }

        var organizer = e.Str("organizer", "emailAddress", "name");
        if (!string.IsNullOrWhiteSpace(organizer))
        {
            parts.Add($"Organizer: {organizer}");
        }

        var showAs = e.Str("showAs");
        if (!string.IsNullOrWhiteSpace(showAs) && showAs != "busy")
        {
            parts.Add($"Shown as {showAs}");
        }

        if (e.Str("isCancelled") == "true")
        {
            parts.Add("cancelled");
        }

        return string.Join(" | ", parts);
    }

    // An event that starts or ends on another day shows the date too.
    private static string Clock(KnowledgeSourceContext context, string? utc)
        => M365Knowledge.Local(context, utc) is not { } local
            ? "?"
            : local.ToString(DateOnly.FromDateTime(local.DateTime) == context.Today ? "HH:mm" : "yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);

    private static DateOnly? StartDate(JsonElement e)
        => DateTime.TryParse(e.Str("start", "dateTime"), CultureInfo.InvariantCulture, DateTimeStyles.None, out var start)
            ? DateOnly.FromDateTime(start)
            : null;
}
