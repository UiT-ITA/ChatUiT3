using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public enum EventResponse
{
    Accept,
    Decline,
    Tentative
}

public sealed record RespondToEventArgs(
    [property: Description("Event id from get_calendar_view.")]
    string EventId,
    EventResponse Response,
    [property: Description("Message to the organizer.")]
    string? Comment);

/// <summary>Answers a meeting invitation after the user has approved it.</summary>
public sealed class RespondToEventFunction : ConfirmableTool<RespondToEventArgs>
{
    private readonly GraphClient _graph;

    public RespondToEventFunction(GraphClient graph) => _graph = graph;

    public override string Id => "respond_to_event";
    public override string DisplayName => "Respond to invitation";
    public override string Description => "Accept, decline or tentatively accept a meeting invitation, optionally with a message to the organizer. The user must approve it first.";
    public override IReadOnlyList<string> RequiredScopes => EventSupport.Scopes;

    protected override async Task<ToolPreview> PrepareAsync(RespondToEventArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var e = await _graph.GetAsync(invocation.Context, $"{EventSupport.EventPath(args.EventId)}?$select=subject,start,organizer", EventSupport.Scopes, ct);

        var fields = new List<ToolPreviewField>
        {
            new("Event", e.Str("subject") ?? ""),
            new("Organizer", e.Str("organizer", "emailAddress", "name") ?? ""),
            new("Start (UTC)", e.Str("start", "dateTime") ?? ""),
            new("Response", args.Response.ToString())
        };
        if (!string.IsNullOrWhiteSpace(args.Comment))
        {
            fields.Add(new ToolPreviewField("Message", args.Comment, Multiline: true));
        }

        return new ToolPreview("Respond to invitation", null, fields, AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(RespondToEventArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var action = args.Response switch { EventResponse.Accept => "accept", EventResponse.Decline => "decline", _ => "tentativelyAccept" };
        await _graph.PostAsync(invocation.Context, $"{EventSupport.EventPath(args.EventId)}/{action}", new { comment = args.Comment ?? "", sendResponse = true }, EventSupport.Scopes, ct);
        return ToolResult.Ok(new { responded = true, response = action }, "Response sent.");
    }
}
