using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record GetMeetingAttendanceArgs(
    [property: Description(MeetingSupport.JoinUrlDescription)]
    string JoinUrl);

public sealed class GetMeetingAttendanceFunction : Tool<GetMeetingAttendanceArgs>
{
    private static readonly string[] Scopes = [M365Scopes.OnlineMeetingsRead, M365Scopes.OnlineMeetingArtifactReadAll];
    private readonly GraphClient _graph;

    public GetMeetingAttendanceFunction(GraphClient graph) => _graph = graph;

    public override string Id => "get_meeting_attendance";
    public override string DisplayName => "Get meeting attendance";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "List who joined a Teams meeting (the most recent occurrence), with join and leave times and minutes attended. Usually only available for meetings the user organized.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(GetMeetingAttendanceArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var meetingId = Uri.EscapeDataString(await MeetingSupport.FindMeetingIdAsync(_graph, invocation.Context, args.JoinUrl, Scopes, ct));
        var reports = await _graph.GetAsync(invocation.Context, $"me/onlineMeetings/{meetingId}/attendanceReports", Scopes, ct);

        var latest = reports.Items().OrderByDescending(r => r.Str("meetingStartDateTime")).Select(r => r.Str("id")).FirstOrDefault();
        if (latest == null)
        {
            return ToolResult.Ok(new { attendees = 0, note = "This meeting has no attendance report." });
        }

        var report = await _graph.GetAsync(invocation.Context,
            $"me/onlineMeetings/{meetingId}/attendanceReports/{Uri.EscapeDataString(latest)}?$expand=attendanceRecords",
            Scopes, ct);

        var records = report.Items("attendanceRecords").Select(r => new
        {
            name = r.Str("identity", "displayName"),
            email = r.Str("emailAddress"),
            role = r.Str("role"),
            minutes = int.TryParse(r.Str("totalAttendanceInSeconds"), out var seconds) ? (int)Math.Round(seconds / 60.0) : 0,
            intervals = r.Items("attendanceIntervals").Select(i => new { joined = i.Str("joinDateTime"), left = i.Str("leaveDateTime") }).ToList()
        }).ToList();

        return ToolResult.Ok(new
        {
            meetingStart = report.Str("meetingStartDateTime"),
            meetingEnd = report.Str("meetingEndDateTime"),
            attendees = records.Count,
            records
        });
    }
}
