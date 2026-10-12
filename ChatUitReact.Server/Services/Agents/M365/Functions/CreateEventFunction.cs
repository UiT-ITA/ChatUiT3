using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record CreateEventArgs(
    [property: Description("Event title.")]
    string Subject,
    [property: Description("Start, ISO 8601 without offset (e.g. 2026-10-20T10:00:00).")]
    string Start,
    [property: Description("End, ISO 8601 without offset.")]
    string End,
    [property: Description("Time zone of start and end, IANA or Windows name (e.g. Europe/Oslo).")]
    string TimeZone,
    [property: Description("Email addresses of people to invite.")]
    List<string>? Attendees,
    [property: Description("Room or place.")]
    string? Location,
    [property: Description("Plain-text description or agenda.")]
    string? Body,
    [property: Description("Add a Teams meeting link.")]
    bool? TeamsMeeting);

/// <summary>Creates an event in the user's calendar and sends invitations after the user has approved it.</summary>
public sealed class CreateEventFunction : ConfirmableTool<CreateEventArgs>
{
    private readonly GraphClient _graph;

    public CreateEventFunction(GraphClient graph) => _graph = graph;

    public override string Id => "create_event";
    public override string DisplayName => "Create calendar event";
    public override string Description => "Create an event in the user's calendar and invite attendees, optionally with a Teams meeting link. The user must approve it first.";
    public override IReadOnlyList<string> RequiredScopes => EventSupport.Scopes;

    protected override Task<ToolPreview> PrepareAsync(CreateEventArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        Body(args);
        var fields = EventSupport.Preview(args.Subject, args.Start, args.End, args.TimeZone, args.Attendees, args.Location, args.Body, args.TeamsMeeting);
        var summary = args.Attendees is { Count: > 0 } ? "Invitations are sent to the attendees." : null;
        return Task.FromResult(new ToolPreview("Create calendar event", summary, fields, AllowEdit: false));
    }

    protected override async Task<ToolResult> CommitAsync(CreateEventArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var created = await _graph.PostAsync(invocation.Context, "me/events", Body(args), EventSupport.Scopes, ct);
        return ToolResult.Ok(new
        {
            created = true,
            eventId = created.Str("id"),
            joinUrl = created.Str("onlineMeeting", "joinUrl"),
            webLink = created.Str("webLink")
        }, "Event created.");
    }

    private static Dictionary<string, object> Body(CreateEventArgs args)
    {
        if (string.IsNullOrWhiteSpace(args.Subject) || string.IsNullOrWhiteSpace(args.Start) || string.IsNullOrWhiteSpace(args.End))
        {
            throw new ToolArgumentException("subject, start and end are required.");
        }

        return EventSupport.Body(args.Subject, args.Start, args.End, args.TimeZone, args.Attendees, args.Location, args.Body, args.TeamsMeeting);
    }
}
