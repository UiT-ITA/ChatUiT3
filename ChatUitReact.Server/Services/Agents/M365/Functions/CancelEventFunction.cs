using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record CancelEventArgs(
    [property: Description("Event id from get_calendar_view.")]
    string EventId,
    [property: Description("Message to the attendees.")]
    string? Comment);

/// <summary>Cancels an event the user organizes after the user has approved it.</summary>
public sealed class CancelEventFunction : ConfirmableTool<CancelEventArgs>
{
    private readonly GraphClient _graph;

    public CancelEventFunction(GraphClient graph) => _graph = graph;

    public override string Id => "cancel_event";
    public override string DisplayName => "Cancel calendar event";
    public override string Description => "Cancel an event the user organizes and notify the attendees. For invitations from others, use respond_to_event with decline. The user must approve it first.";
    public override IReadOnlyList<string> RequiredScopes => EventSupport.Scopes;

    protected override async Task<ToolPreview> PrepareAsync(CancelEventArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var e = await _graph.GetAsync(invocation.Context, $"{EventSupport.EventPath(args.EventId)}?$select=subject,start,attendees,isOrganizer", EventSupport.Scopes, ct);
        if (e.Str("isOrganizer") != "true")
        {
            throw new ToolArgumentException("The user is not the organizer of this event. Use respond_to_event with decline instead.");
        }

        var fields = new List<ToolPreviewField>
        {
            new("Event", e.Str("subject") ?? ""),
            new("Start (UTC)", e.Str("start", "dateTime") ?? ""),
            new("Attendees notified", e.Items("attendees").Count().ToString())
        };
        if (!string.IsNullOrWhiteSpace(args.Comment))
        {
            fields.Add(new ToolPreviewField("Message", args.Comment, Multiline: true));
        }

        return new ToolPreview("Cancel calendar event", null, fields, AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(CancelEventArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        await _graph.PostAsync(invocation.Context, $"{EventSupport.EventPath(args.EventId)}/cancel", new { comment = args.Comment ?? "" }, EventSupport.Scopes, ct);
        return ToolResult.Ok(new { cancelled = true, eventId = args.EventId }, "Event cancelled.");
    }
}
