using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record GetMeetingTranscriptArgs(
    [property: Description(MeetingSupport.JoinUrlDescription)]
    string JoinUrl);

public sealed class GetMeetingTranscriptFunction : Tool<GetMeetingTranscriptArgs>
{
    private const int MaxChars = 150_000;
    private const long MaxBytes = 4 * 1024 * 1024;
    private static readonly string[] Scopes = [M365Scopes.OnlineMeetingsRead, M365Scopes.OnlineMeetingTranscriptReadAll];
    private static readonly Regex Cue = new(@"^<v ([^>]+)>(.*?)(</v>)?$", RegexOptions.Compiled);

    private readonly GraphClient _graph;

    public GetMeetingTranscriptFunction(GraphClient graph) => _graph = graph;

    public override string Id => "get_meeting_transcript";
    public override string DisplayName => "Get meeting transcript";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Get the transcript of a Teams meeting as 'speaker: text' lines. Usually only available for meetings the user organized.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(GetMeetingTranscriptArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var meetingId = Uri.EscapeDataString(await MeetingSupport.FindMeetingIdAsync(_graph, invocation.Context, args.JoinUrl, Scopes, ct));
        var transcripts = await _graph.GetAsync(invocation.Context, $"me/onlineMeetings/{meetingId}/transcripts", Scopes, ct);

        var text = new StringBuilder();
        var list = transcripts.Items().OrderBy(t => t.Str("createdDateTime")).ToList();
        foreach (var transcript in list)
        {
            var vtt = await _graph.GetTextAsync(invocation.Context,
                $"me/onlineMeetings/{meetingId}/transcripts/{Uri.EscapeDataString(transcript.Str("id")!)}/content?$format=text/vtt",
                Scopes, MaxBytes, ct);
            AppendLines(text, vtt);
        }

        if (list.Count == 0)
        {
            return ToolResult.Ok(new { transcripts = 0, transcript = (string?)null, note = "This meeting has no transcript." });
        }

        var (content, truncated) = TextFiles.Cap(text.ToString(), MaxChars);
        return ToolResult.Ok(new { transcripts = list.Count, transcript = content, truncated });
    }

    /// <summary>Turns WebVTT cues into "speaker: text" lines, merging consecutive cues from the same speaker.</summary>
    private static void AppendLines(StringBuilder text, string vtt)
    {
        string? speaker = null;
        foreach (var line in vtt.Split('\n').Select(l => l.Trim()))
        {
            var match = Cue.Match(line);
            if (!match.Success)
            {
                continue;
            }

            var name = match.Groups[1].Value;
            if (name == speaker)
            {
                text.Append(' ').Append(match.Groups[2].Value);
            }
            else
            {
                text.Append(text.Length == 0 ? "" : "\n").Append(name).Append(": ").Append(match.Groups[2].Value);
                speaker = name;
            }
        }
    }
}
