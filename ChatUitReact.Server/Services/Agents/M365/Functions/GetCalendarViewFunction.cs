using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record GetCalendarViewArgs(
    [property: Description("Start of the window, ISO 8601 (e.g. 2026-09-22T00:00:00).")]
    string Start,
    [property: Description("End of the window, ISO 8601. At most 31 days after start.")]
    string End,
    [property: Description("Time zone for both the window and the returned times, IANA or Windows name (e.g. Europe/Oslo). Defaults to UTC.")]
    string? TimeZone,
    [property: Description("Another user's id or email to read their calendar instead of the signed-in user's. Only works when that calendar is shared with the user.")]
    string? UserIdOrEmail);

public sealed class GetCalendarViewFunction : Tool<GetCalendarViewArgs>
{
    private static readonly string[] Scopes = [M365Scopes.CalendarsRead, M365Scopes.CalendarsReadShared];
    private readonly GraphClient _graph;

    public GetCalendarViewFunction(GraphClient graph) => _graph = graph;

    public override string Id => "get_calendar_view";
    public override string DisplayName => "Get calendar";
    public override string Description => "List calendar events in a time window for the signed-in user, or for a colleague whose calendar is shared with them. Returns subject, start, end, location, organizer, attendees and free/busy status.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(GetCalendarViewArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        if (!DateTime.TryParse(args.Start, out var start) || !DateTime.TryParse(args.End, out var end))
        {
            return ToolResult.Error("start and end must be ISO 8601 date-times.");
        }

        if (end <= start || (end - start).TotalDays > 31)
        {
            return ToolResult.Error("end must be after start and at most 31 days later.");
        }

        var timeZone = string.IsNullOrWhiteSpace(args.TimeZone) ? "UTC" : args.TimeZone.Trim();
        var owner = GraphClient.UserPath(args.UserIdOrEmail);

        var path = $"{owner}/calendarView?startDateTime={Uri.EscapeDataString(start.ToString("s"))}&endDateTime={Uri.EscapeDataString(end.ToString("s"))}"
                 + "&$top=100&$orderby=start/dateTime&$select=id,subject,start,end,isAllDay,location,organizer,attendees,showAs,isCancelled,webLink,onlineMeeting";

        var response = await _graph.GetAsync(invocation.Context, path, Scopes, ct, preferHeader: $"outlook.timezone=\"{timeZone}\"");

        var events = response.Items().Select(e => new
        {
            id = e.Str("id"),
            subject = e.Str("subject"),
            start = e.Str("start", "dateTime"),
            end = e.Str("end", "dateTime"),
            isAllDay = e.Str("isAllDay") == "true",
            showAs = e.Str("showAs"),
            isCancelled = e.Str("isCancelled") == "true",
            location = e.Str("location", "displayName"),
            organizer = e.Str("organizer", "emailAddress", "name"),
            attendees = e.Items("attendees").Select(a => a.Str("emailAddress", "name") ?? a.Str("emailAddress", "address")).Where(n => n != null).ToList(),
            joinUrl = e.Str("onlineMeeting", "joinUrl"),
            webLink = e.Str("webLink")
        }).ToList();

        return ToolResult.Ok(new { timeZone, start = start.ToString("s"), end = end.ToString("s"), count = events.Count, events });
    }
}
