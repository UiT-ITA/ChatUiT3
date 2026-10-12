using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

/// <summary>Resolves a Teams join link to the online meeting that transcripts and attendance hang off.</summary>
internal static class MeetingSupport
{
    public const string JoinUrlDescription = "Teams join link (joinUrl) from get_calendar_view or get_event.";

    public static async Task<string> FindMeetingIdAsync(GraphClient graph, ToolExecutionContext context, string joinUrl, string[] scopes, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(joinUrl))
        {
            throw new ToolArgumentException("joinUrl is required.");
        }

        var filter = Uri.EscapeDataString($"JoinWebUrl eq '{joinUrl.Trim().Replace("'", "''")}'");
        var response = await graph.GetAsync(context, $"me/onlineMeetings?$filter={filter}&$select=id", scopes, ct);

        return response.Items().Select(m => m.Str("id")).FirstOrDefault(id => id != null)
            ?? throw new ToolArgumentException("No Teams meeting was found for this join link.");
    }
}
