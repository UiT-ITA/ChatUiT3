using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record GetScheduleArgs(
    [property: Description("Email addresses (userPrincipalName) of the people to check, including the signed-in user's own if their availability matters. Up to 20.")]
    List<string> Emails,
    [property: Description("Start of the window, ISO 8601 without offset (e.g. 2026-09-23T08:00:00).")]
    string Start,
    [property: Description("End of the window, ISO 8601 without offset.")]
    string End,
    [property: Description("Time zone of start/end and of the returned times, IANA or Windows name. Defaults to UTC. Use the time zone the user gave; when they gave none, use Europe/Oslo and say so.")]
    string? TimeZone,
    [property: Description("Slot length in minutes for the availability view, 5 to 1440. Defaults to 30.")]
    int? IntervalMinutes);

/// <summary>Free/busy for several people at once; the right function for "when are X and Y both free".</summary>
public sealed class GetScheduleFunction : Tool<GetScheduleArgs>
{
    private static readonly string[] Scopes = [M365Scopes.CalendarsRead, M365Scopes.CalendarsReadShared];
    private readonly GraphClient _graph;

    public GetScheduleFunction(GraphClient graph) => _graph = graph;

    public override string Id => "get_schedule";
    public override string DisplayName => "Get free/busy";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Get free/busy information for several people in one call. Returns, per person, an availability string (one character per slot: 0 free, 1 tentative, 2 busy, 3 out of office, 4 working elsewhere) and the busy items with start/end. Use this to find common free time. Get people's email addresses and ids from find_people; never build an email address from a name.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(GetScheduleArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var emails = args.Emails.Where(e => !string.IsNullOrWhiteSpace(e)).Select(e => e.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Take(20).ToList();
        if (emails.Count == 0)
        {
            return ToolResult.Error("emails must contain at least one address.");
        }

        if (!DateTime.TryParse(args.Start, out var start) || !DateTime.TryParse(args.End, out var end) || end <= start)
        {
            return ToolResult.Error("start and end must be ISO 8601 date-times with end after start.");
        }

        var timeZone = string.IsNullOrWhiteSpace(args.TimeZone) ? "UTC" : args.TimeZone.Trim();
        var interval = Math.Clamp(args.IntervalMinutes ?? 30, 5, 1440);

        var body = new
        {
            schedules = emails,
            startTime = new { dateTime = start.ToString("s"), timeZone },
            endTime = new { dateTime = end.ToString("s"), timeZone },
            availabilityViewInterval = interval
        };

        var response = await _graph.PostAsync(invocation.Context, "me/calendar/getSchedule", body, Scopes, ct);

        var schedules = response.Items().Select(s => new
        {
            email = s.Str("scheduleId"),
            error = s.Str("error", "message"),
            availabilityView = s.Str("availabilityView"),
            busy = s.Items("scheduleItems").Select(i => new
            {
                status = i.Str("status"),
                subject = i.Str("subject"),
                start = i.Str("start", "dateTime"),
                end = i.Str("end", "dateTime")
            }).ToList()
        }).ToList();

        return ToolResult.Ok(new { timeZone, start = start.ToString("s"), end = end.ToString("s"), intervalMinutes = interval, schedules });
    }
}
