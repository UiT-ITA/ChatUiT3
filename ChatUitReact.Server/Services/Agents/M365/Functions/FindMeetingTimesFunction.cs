using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record FindMeetingTimesArgs(
    [property: Description("Email addresses of the attendees. The signed-in user is included automatically.")]
    List<string> Attendees,
    [property: Description("Start of the search window, ISO 8601 without offset.")]
    string Start,
    [property: Description("End of the search window, ISO 8601 without offset.")]
    string End,
    [property: Description("Meeting length in minutes.")]
    int DurationMinutes,
    [property: Description("Time zone of start/end and of the returned times, IANA or Windows name. Defaults to UTC.")]
    string? TimeZone);

public sealed class FindMeetingTimesFunction : Tool<FindMeetingTimesArgs>
{
    private static readonly string[] Scopes = [M365Scopes.CalendarsReadShared];
    private readonly GraphClient _graph;

    public FindMeetingTimesFunction(GraphClient graph) => _graph = graph;

    public override string Id => "find_meeting_times";
    public override string DisplayName => "Find meeting times";
    public override string Description => "Suggest meeting times within working hours when the user and all attendees are free.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(FindMeetingTimesArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var attendees = MailSupport.Addresses(args.Attendees);
        if (!DateTime.TryParse(args.Start, out var start) || !DateTime.TryParse(args.End, out var end) || end <= start)
        {
            return ToolResult.Error("start and end must be ISO 8601 date-times with end after start.");
        }

        if (args.DurationMinutes is < 5 or > 1440)
        {
            return ToolResult.Error("durationMinutes must be between 5 and 1440.");
        }

        var timeZone = string.IsNullOrWhiteSpace(args.TimeZone) ? "UTC" : args.TimeZone.Trim();
        var body = new
        {
            attendees = attendees.Select(a => new { type = "required", emailAddress = new { address = a } }).ToList(),
            timeConstraint = new
            {
                activityDomain = "work",
                timeSlots = new[] { new { start = new { dateTime = start.ToString("s"), timeZone }, end = new { dateTime = end.ToString("s"), timeZone } } }
            },
            meetingDuration = $"PT{args.DurationMinutes}M",
            maxCandidates = 10,
            returnSuggestionReasons = true
        };

        var response = await _graph.PostAsync(invocation.Context, "me/findMeetingTimes", body, Scopes, ct, preferHeader: $"outlook.timezone=\"{timeZone}\"");

        var suggestions = response.Items("meetingTimeSuggestions").Select(s => new
        {
            start = s.Str("meetingTimeSlot", "start", "dateTime"),
            end = s.Str("meetingTimeSlot", "end", "dateTime"),
            confidence = s.Str("confidence"),
            unavailable = s.Items("attendeeAvailability")
                .Where(a => a.Str("availability") is not ("free" or null))
                .Select(a => $"{a.Str("attendee", "emailAddress", "address")}: {a.Str("availability")}")
                .ToList()
        }).ToList();

        return ToolResult.Ok(new { timeZone, emptyReason = response.Str("emptySuggestionsReason"), count = suggestions.Count, suggestions });
    }
}
