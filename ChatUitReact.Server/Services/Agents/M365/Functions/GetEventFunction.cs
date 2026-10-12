using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record GetEventArgs(
    [property: Description("Event id from get_calendar_view.")]
    string EventId,
    [property: Description("Time zone for the returned times, IANA or Windows name. Defaults to UTC.")]
    string? TimeZone,
    [property: Description("Id or email of the colleague whose shared calendar holds the event. Omit for the user's own.")]
    string? UserIdOrEmail);

public sealed class GetEventFunction : Tool<GetEventArgs>
{
    private const int MaxBodyChars = 20_000;
    private static readonly string[] Scopes = [M365Scopes.CalendarsRead, M365Scopes.CalendarsReadShared];
    private readonly GraphClient _graph;

    public GetEventFunction(GraphClient graph) => _graph = graph;

    public override string Id => "get_event";
    public override string DisplayName => "Get calendar event";
    public override string Description => "Get one calendar event in full: body as text, attendee responses, recurrence and Teams join link.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(GetEventArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(args.EventId))
        {
            return ToolResult.Error("eventId is required.");
        }

        var timeZone = string.IsNullOrWhiteSpace(args.TimeZone) ? "UTC" : args.TimeZone.Trim();
        var e = await _graph.GetAsync(invocation.Context,
            $"{GraphClient.UserPath(args.UserIdOrEmail)}/events/{Uri.EscapeDataString(args.EventId.Trim())}"
            + "?$select=id,subject,start,end,isAllDay,location,organizer,attendees,body,recurrence,onlineMeeting,responseStatus,showAs,isCancelled,webLink",
            Scopes, ct, preferHeader: $"outlook.timezone=\"{timeZone}\", outlook.body-content-type=\"text\"");

        var (body, truncated) = TextFiles.Cap(e.Str("body", "content") ?? string.Empty, MaxBodyChars);

        return ToolResult.Ok(new
        {
            id = e.Str("id"),
            subject = e.Str("subject"),
            timeZone,
            start = e.Str("start", "dateTime"),
            end = e.Str("end", "dateTime"),
            isAllDay = e.Str("isAllDay") == "true",
            isCancelled = e.Str("isCancelled") == "true",
            showAs = e.Str("showAs"),
            myResponse = e.Str("responseStatus", "response"),
            location = e.Str("location", "displayName"),
            organizer = e.Str("organizer", "emailAddress", "name"),
            attendees = e.Items("attendees").Select(a => new
            {
                name = a.Str("emailAddress", "name"),
                email = a.Str("emailAddress", "address"),
                type = a.Str("type"),
                response = a.Str("status", "response")
            }).ToList(),
            recurrence = e.Str("recurrence", "pattern", "type"),
            recurrenceInterval = e.Str("recurrence", "pattern", "interval"),
            recurrenceEnds = e.Str("recurrence", "range", "endDate"),
            joinUrl = e.Str("onlineMeeting", "joinUrl"),
            body,
            truncated,
            webLink = e.Str("webLink")
        });
    }
}
