using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record UpdateEventArgs(
    [property: Description("Event id from get_calendar_view.")]
    string EventId,
    [property: Description("New title.")]
    string? Subject,
    [property: Description("New start, ISO 8601 without offset.")]
    string? Start,
    [property: Description("New end, ISO 8601 without offset.")]
    string? End,
    [property: Description("Time zone of start and end. Required when either is given. Use the time zone the user gave; when they gave none, use Europe/Oslo and say so.")]
    string? TimeZone,
    [property: Description("Email addresses of all attendees. Replaces the current list.")]
    List<string>? Attendees,
    [property: Description("New room or place.")]
    string? Location,
    [property: Description("New plain-text description. Replaces the current one.")]
    string? Body);

/// <summary>Changes an event in the user's calendar after the user has approved it.</summary>
public sealed class UpdateEventFunction : ConfirmableTool<UpdateEventArgs>
{
    private readonly GraphClient _graph;

    public UpdateEventFunction(GraphClient graph) => _graph = graph;

    public override string Id => "update_event";
    public override string DisplayName => "Update calendar event";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Change an event in the user's calendar. Only given fields change. Attendees get an update. The user must approve it first. If they reject it, do not retry or change it. Get people's email addresses and ids from find_people; never build an email address from a name.";
    public override IReadOnlyList<string> RequiredScopes => EventSupport.Scopes;

    protected override async Task<ToolPreview> PrepareAsync(UpdateEventArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        Changes(args);
        var current = await _graph.GetAsync(invocation.Context, $"{EventSupport.EventPath(args.EventId)}?$select=subject", EventSupport.Scopes, ct);

        var fields = new List<ToolPreviewField> { new("Event", current.Str("subject") ?? "") };
        fields.AddRange(EventSupport.Preview(args.Subject, args.Start, args.End, args.TimeZone, args.Attendees, args.Location, args.Body, null));
        return new ToolPreview("Update calendar event", null, fields, AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(UpdateEventArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var updated = await _graph.PatchAsync(invocation.Context, EventSupport.EventPath(args.EventId), Changes(args), EventSupport.Scopes, ct);
        return ToolResult.Ok(new { updated = true, eventId = updated.Str("id") ?? args.EventId, webLink = updated.Str("webLink") }, "Event updated.");
    }

    private static Dictionary<string, object> Changes(UpdateEventArgs args)
    {
        var changes = EventSupport.Body(args.Subject, args.Start, args.End, args.TimeZone, args.Attendees, args.Location, args.Body, null);
        if (changes.Count == 0)
        {
            throw new ToolArgumentException("Give at least one field to change.");
        }

        return changes;
    }
}
