using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Threading;
using Microsoft.Extensions.Logging;

namespace ChatUiT.Server.Services.AiProviders;

using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

/// <summary>
/// Drives the assistant turn / tool-call loop for every provider.
///
/// This lives outside the providers on purpose. The loop itself — stream a turn, execute
/// whatever tools were requested, feed the results back, repeat — is identical everywhere;
/// only the wire representation differs, and that stays behind <see cref="IAiConversation"/>.
/// Keeping it here also means the round cap and cancellation are enforced once rather than
/// re-implemented per provider.
///
/// It also records the generation's <see cref="MessageActivity"/>: thinking summaries, tool
/// calls, and timings; and its transcript: what the model produced and received, replayed on
/// later turns. The caller owns both so a run that fails midway still leaves the partial record
/// behind.
///
/// Tools of <see cref="AiRequest.LoadableTools"/> are callable once a toolbox load (in the
/// history or in this run) has named them.
///
/// A call that needs the user or the client ends the run: the round's other calls still run, the
/// waiting calls stay open in the activity, and the run ends with an
/// <see cref="ChatStreamChunkKind.AwaitingUser"/> chunk. <see cref="ResumeAsync"/> continues those
/// calls with their answers on a later run of the same message, which then goes on with
/// <see cref="StreamAsync"/>.
/// </summary>
public sealed class AiConversationRunner
{
    /// <summary>
    /// How many times the model may call tools and be given the results before the run stops.
    /// Without a cap a model that keeps requesting tools would loop indefinitely.
    /// </summary>
    private const int MaxToolRounds = 20;

    private readonly IAiProviderRegistry _providers;
    private readonly IToolExecutor _toolExecutor;
    private readonly ILogger<AiConversationRunner> _logger;

    public AiConversationRunner(
        IAiProviderRegistry providers,
        IToolExecutor toolExecutor,
        ILogger<AiConversationRunner> logger)
    {
        _providers = providers;
        _toolExecutor = toolExecutor;
        _logger = logger;
    }

    public async IAsyncEnumerable<ChatStreamChunk> StreamAsync(
        AiRequest request,
        ToolExecutionContext context,
        MessageActivity activity,
        List<TranscriptItem> transcript,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var chatId = context.ChatId;
        var loaded = new HashSet<string>(request.LoadedToolIds, StringComparer.Ordinal);
        var clock = new RunClock(activity.TotalMs);
        activity.Model = request.Model.ModelId;
        activity.Effort = request.Parameters.Effort;

        var provider = _providers.For(request.Endpoint.EndpointType);
        var conversation = provider.StartConversation(request);

        for (var round = 0; ; round++)
        {
            var toolCalls = new List<AiStreamEvent.ToolCall>();
            ActivityEntry? thinking = null;
            var thinkingText = new StringBuilder();
            var roundText = new StringBuilder();
            JsonElement? reasoningState = null;

            await foreach (var streamEvent in conversation.StreamTurnAsync(cancellationToken: cancellationToken))
            {
                switch (streamEvent)
                {
                    case AiStreamEvent.Text text when !string.IsNullOrEmpty(text.Delta):
                        CloseThinking();
                        roundText.Append(text.Delta);
                        yield return new ChatStreamChunk { Kind = ChatStreamChunkKind.Text, Text = text.Delta, ElapsedMs = clock.Now };
                        break;
                    case AiStreamEvent.Thinking delta when !string.IsNullOrEmpty(delta.Delta):
                        if (thinking == null)
                        {
                            thinking = new ActivityEntry { Type = ActivityEntryType.Thinking, StartedMs = clock.Now };
                            activity.Entries.Add(thinking);
                        }

                        thinkingText.Append(delta.Delta);
                        thinking.Text = thinkingText.ToString();
                        yield return new ChatStreamChunk { Kind = ChatStreamChunkKind.Thinking, Text = delta.Delta, ElapsedMs = clock.Now };
                        break;
                    case AiStreamEvent.ThinkingBreak when thinking != null && thinkingText.Length > 0:
                        // Summary parts arrive without separators; a paragraph break keeps them readable.
                        const string ParagraphBreak = "\n\n";
                        if (!thinkingText.ToString().EndsWith(ParagraphBreak))
                        {
                            thinkingText.Append(ParagraphBreak);
                            thinking.Text = thinkingText.ToString();
                            yield return new ChatStreamChunk { Kind = ChatStreamChunkKind.Thinking, Text = ParagraphBreak, ElapsedMs = clock.Now };
                        }
                        break;
                    case AiStreamEvent.ToolCall call:
                        toolCalls.Add(call);
                        break;
                    case AiStreamEvent.ReasoningState state:
                        reasoningState = state.Payload;
                        break;
                }
            }

            CloseThinking();
            RecordTurn(transcript, request, reasoningState, roundText.ToString(), toolCalls);

            if (toolCalls.Count == 0)
            {
                break;
            }

            if (round >= MaxToolRounds)
            {
                _logger.LogWarning(
                    "Stopping chat {ChatId} after {Rounds} tool rounds; the model kept requesting tools.",
                    chatId, MaxToolRounds);
                yield return new ChatStreamChunk { Kind = ChatStreamChunkKind.Text, Text = $"\n_{ToolRoundLimitText}_\n", ElapsedMs = clock.Now };
                break;
            }

            activity.ToolRounds++;
            var results = new List<AiToolResult>(toolCalls.Count);
            var outcome = new RoundOutcome();

            foreach (var call in toolCalls)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var (tool, notLoaded) = FindTool(request, loaded, call.FunctionName);

                var entry = new ActivityEntry
                {
                    Type = ActivityEntryType.Tool,
                    StartedMs = clock.Now,
                    ToolCallId = call.Id,
                    ToolName = call.FunctionName,
                    ArgumentsJson = call.ArgumentsJson,
                    Execution = tool?.Execution ?? ToolExecution.Server,
                    Status = ToolCallStatus.Running
                };
                activity.Entries.Add(entry);

                // Announced before the tool runs so the UI can show the call while it is in flight.
                yield return new ChatStreamChunk
                {
                    Kind = ChatStreamChunkKind.ToolStart,
                    ElapsedMs = entry.StartedMs,
                    ToolCallId = call.Id,
                    ToolName = call.FunctionName,
                    ArgumentsJson = call.ArgumentsJson,
                    Execution = entry.Execution
                };

                if (tool == null)
                {
                    _logger.LogWarning("Model called unknown tool {ToolName} in chat {ChatId}", call.FunctionName, chatId);
                    var unknown = ToolResult.Error(notLoaded
                        ? $"{call.FunctionName} is not loaded. Load its toolbox with {LoadToolsTool.ToolId} first."
                        : $"Unknown tool: {call.FunctionName}");
                    yield return CompleteEntry(entry, unknown, ToolCallStatus.Error, results, call.Id, clock.Now);
                    continue;
                }

                await foreach (var chunk in TrackAsync(entry, call, _toolExecutor.ExecuteAsync(tool, call, context, cancellationToken), results, outcome, clock))
                {
                    yield return chunk;
                }
            }

            AddResults(transcript, results, loaded);

            if (outcome.Waiting)
            {
                Pause(activity, clock.Now);
                yield return new ChatStreamChunk { Kind = ChatStreamChunkKind.AwaitingUser, ElapsedMs = activity.TotalMs, Activity = activity };
                yield break;
            }

            conversation.AppendToolResults(results);

            void CloseThinking()
            {
                if (thinking == null)
                {
                    return;
                }

                thinking.EndedMs = clock.Now;
                thinking = null;
                thinkingText.Clear();
            }
        }

        Finish(activity, clock.Now);
        yield return new ChatStreamChunk { Kind = ChatStreamChunkKind.Done, ElapsedMs = activity.TotalMs, Activity = activity };
    }

    /// <summary>
    /// Continues the calls a message waited on, with the answers they got, and records their
    /// results in the transcript. Ends with an <see cref="ChatStreamChunkKind.AwaitingUser"/> chunk
    /// when a call waits again; otherwise the caller goes on with <see cref="StreamAsync"/> on a
    /// request whose history holds these results.
    /// </summary>
    public async IAsyncEnumerable<ChatStreamChunk> ResumeAsync(
        AiRequest request,
        ToolExecutionContext context,
        MessageActivity activity,
        List<TranscriptItem> transcript,
        IReadOnlyList<ResumedCall> calls,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var loaded = new HashSet<string>(request.LoadedToolIds, StringComparer.Ordinal);
        var clock = new RunClock(activity.TotalMs);
        var results = new List<AiToolResult>(calls.Count);
        var outcome = new RoundOutcome();

        yield return new ChatStreamChunk { Kind = ChatStreamChunkKind.Continued, ElapsedMs = clock.Now, Activity = activity };

        foreach (var (entry, input) in calls)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var call = new AiStreamEvent.ToolCall(entry.ToolCallId!, entry.ToolName!, OriginalArguments(transcript, entry));
            var (tool, _) = FindTool(request, loaded, call.FunctionName);
            if (tool == null)
            {
                yield return CompleteEntry(entry, ToolResult.Error($"Unknown tool: {call.FunctionName}"), ToolCallStatus.Error, results, call.Id, clock.Now);
                continue;
            }

            await foreach (var chunk in TrackAsync(entry, call, _toolExecutor.ResumeAsync(tool, call, context, input, cancellationToken), results, outcome, clock))
            {
                yield return chunk;
            }
        }

        AddResults(transcript, results, loaded);

        if (outcome.Waiting)
        {
            Pause(activity, clock.Now);
            yield return new ChatStreamChunk { Kind = ChatStreamChunkKind.AwaitingUser, ElapsedMs = activity.TotalMs, Activity = activity };
            yield break;
        }

        activity.TotalMs = clock.Now;
    }

    /// <summary>
    /// Gives every call the message waits on the result <see cref="NotRespondedText"/> and the
    /// status <see cref="ToolCallStatus.Unanswered"/>: the user sent a new message instead of answering.
    /// </summary>
    public static void LeaveUnanswered(MessageActivity activity, List<TranscriptItem> transcript)
    {
        foreach (var entry in activity.Entries.Where(e => e.Type == ActivityEntryType.Tool && e.Status.IsAwaiting()))
        {
            entry.Status = ToolCallStatus.Unanswered;
            entry.EndedMs = activity.TotalMs;
            entry.Result = NotRespondedText;
            entry.IsError = true;
            entry.Response = null;
            transcript.Add(new TranscriptItem { Kind = TranscriptItemKind.ToolResult, ToolCallId = entry.ToolCallId, Content = NotRespondedText, IsError = true });
        }

        SetTotals(activity, activity.TotalMs);
    }

    /// <summary>Applies one call's executor events to its entry and yields the chunks they become.</summary>
    private static async IAsyncEnumerable<ChatStreamChunk> TrackAsync(
        ActivityEntry entry,
        AiStreamEvent.ToolCall call,
        IAsyncEnumerable<ToolExecutionEvent> events,
        List<AiToolResult> results,
        RoundOutcome outcome,
        RunClock clock)
    {
        await foreach (var evt in events)
        {
            switch (evt)
            {
                case ToolExecutionEvent.StatusChanged status:
                    entry.Status = status.Status;
                    if (status.ArgumentsJson != null)
                    {
                        entry.ArgumentsJson = status.ArgumentsJson;
                    }

                    yield return new ChatStreamChunk
                    {
                        Kind = ChatStreamChunkKind.ToolStatus,
                        ElapsedMs = clock.Now,
                        ToolCallId = call.Id,
                        ToolName = call.FunctionName,
                        ArgumentsJson = status.ArgumentsJson,
                        Status = entry.Status
                    };
                    break;

                case ToolExecutionEvent.Completed completed:
                    yield return CompleteEntry(entry, completed.Result, completed.Status, results, call.Id, clock.Now);
                    break;

                case ToolExecutionEvent.Deferred deferred:
                    outcome.Waiting = true;
                    yield return Wait(entry, call, deferred.Step, clock.Now);
                    break;
            }
        }
    }

    /// <summary>Puts the entry in the awaiting status of the step and returns the chunk that announces it.</summary>
    private static ChatStreamChunk Wait(ActivityEntry entry, AiStreamEvent.ToolCall call, DeferredStep step, long elapsedMs)
    {
        entry.Response = null;
        var chunk = new ChatStreamChunk { ElapsedMs = elapsedMs, ToolCallId = call.Id, ToolName = call.FunctionName, ArgumentsJson = entry.ArgumentsJson };
        switch (step)
        {
            case DeferredStep.Confirmation confirmation:
                entry.Status = ToolCallStatus.AwaitingConfirmation;
                entry.Preview = ToPreviewDto(confirmation.Preview);
                chunk.Kind = ChatStreamChunkKind.ToolConfirmationRequested;
                chunk.Preview = entry.Preview;
                break;

            case DeferredStep.Questions questions:
                entry.Status = ToolCallStatus.AwaitingAnswer;
                entry.Questions = questions.Values.Select(ToQuestionDto).ToList();
                chunk.Kind = ChatStreamChunkKind.ToolQuestionRequested;
                chunk.Questions = entry.Questions;
                break;

            default:
                entry.Status = ToolCallStatus.AwaitingClient;
                chunk.Kind = ChatStreamChunkKind.ToolClientCallRequested;
                break;
        }

        chunk.Status = entry.Status;
        return chunk;
    }

    /// <summary>Adds the results to the transcript and the tools a toolbox load named to <paramref name="loaded"/>.</summary>
    private static void AddResults(List<TranscriptItem> transcript, List<AiToolResult> results, HashSet<string> loaded)
    {
        foreach (var result in results)
        {
            loaded.UnionWith(result.LoadedToolIds ?? []);
            transcript.Add(new TranscriptItem
            {
                Kind = TranscriptItemKind.ToolResult,
                ToolCallId = result.ToolCallId,
                Content = result.Content,
                IsError = result.IsError,
                LoadedToolIds = result.LoadedToolIds is { Count: > 0 } ids ? ids.ToList() : null,
                Images = result.Images is { Count: > 0 } images ? images.Select(i => new TranscriptImage { Base64 = i.Base64, MediaType = i.MediaType }).ToList() : null
            });
        }
    }

    /// <summary>The arguments the model called with, as the transcript recorded them.</summary>
    private static string OriginalArguments(List<TranscriptItem> transcript, ActivityEntry entry)
        => transcript.LastOrDefault(item => item.Kind == TranscriptItemKind.ToolCall && item.ToolCallId == entry.ToolCallId)?.ArgumentsJson
            ?? entry.ArgumentsJson
            ?? "{}";

    /// <summary>
    /// The tool the model called: one of the request's tools, or a loadable tool a load named.
    /// <c>NotLoaded</c> is true for a loadable tool no load has named yet.
    /// </summary>
    private static (ITool? Tool, bool NotLoaded) FindTool(AiRequest request, HashSet<string> loaded, string name)
    {
        if (request.Tools.FirstOrDefault(t => t.Id == name) is { } tool)
        {
            return (tool, false);
        }

        var loadable = request.LoadableTools.FirstOrDefault(t => t.Id == name);
        return loadable != null && loaded.Contains(name) ? (loadable, false) : (null, loadable != null);
    }

    /// <summary>One round as the model produced it: reasoning state first, then its text, then its tool calls.</summary>
    private static void RecordTurn(List<TranscriptItem> transcript, AiRequest request, JsonElement? reasoningState, string text, List<AiStreamEvent.ToolCall> toolCalls)
    {
        if (reasoningState is { } payload)
        {
            transcript.Add(new TranscriptItem
            {
                Kind = TranscriptItemKind.Reasoning,
                Protocol = request.Model.ApiProtocol,
                ModelId = request.Model.Id,
                Payload = payload
            });
        }

        if (text.Length > 0)
        {
            transcript.Add(new TranscriptItem { Kind = TranscriptItemKind.Text, Text = text });
        }

        foreach (var call in toolCalls)
        {
            transcript.Add(new TranscriptItem
            {
                Kind = TranscriptItemKind.ToolCall,
                ToolCallId = call.Id,
                Name = call.FunctionName,
                ArgumentsJson = call.ArgumentsJson
            });
        }
    }

    /// <summary>
    /// Fills in the totals. Also called by the owner when a run fails, so a partial record
    /// still adds up; an entry left open is closed at the same moment.
    /// </summary>
    public static void Finish(MessageActivity activity, long totalMs)
    {
        foreach (var entry in activity.Entries.Where(entry => entry.EndedMs == null))
        {
            entry.EndedMs = totalMs;
            if (entry.Type == ActivityEntryType.Tool && !entry.Status.IsTerminal())
            {
                entry.Status = ToolCallStatus.Error;
                entry.IsError = true;
            }
        }

        SetTotals(activity, totalMs);
    }

    /// <summary>The totals of a run that ends with calls waiting; the waiting entries stay open.</summary>
    private static void Pause(MessageActivity activity, long totalMs)
    {
        foreach (var entry in activity.Entries.Where(entry => entry.EndedMs == null && !(entry.Type == ActivityEntryType.Tool && entry.Status.IsAwaiting())))
        {
            entry.EndedMs = totalMs;
        }

        SetTotals(activity, totalMs);
    }

    private static void SetTotals(MessageActivity activity, long totalMs)
    {
        activity.TotalMs = totalMs;
        activity.ThinkingMs = activity.Entries
            .Where(entry => entry.Type == ActivityEntryType.Thinking)
            .Sum(entry => (entry.EndedMs ?? totalMs) - entry.StartedMs);
        activity.ToolMs = activity.Entries
            .Where(entry => entry.Type == ActivityEntryType.Tool)
            .Sum(entry => (entry.EndedMs ?? totalMs) - entry.StartedMs);
    }

    private static ChatStreamChunk CompleteEntry(
        ActivityEntry entry,
        ToolResult result,
        ToolCallStatus status,
        List<AiToolResult> results,
        string toolCallId,
        long elapsedMs)
    {
        entry.EndedMs = elapsedMs;
        entry.Result = result.DisplayText;
        entry.IsError = result.IsError;
        entry.Status = status;

        results.Add(new AiToolResult(toolCallId, result.Content, result.IsError, result.LoadedToolIds, result.Images));

        return new ChatStreamChunk
        {
            Kind = ChatStreamChunkKind.ToolEnd,
            ElapsedMs = elapsedMs,
            ToolCallId = toolCallId,
            ToolName = entry.ToolName,
            Result = entry.Result,
            IsError = entry.IsError,
            Status = status
        };
    }

    private static ToolPreviewDto ToPreviewDto(ToolPreview preview) => new()
    {
        Title = preview.Title,
        Summary = preview.Summary,
        AllowEdit = preview.AllowEdit,
        Kind = preview.Kind,
        Fields = preview.Fields.Select(f => new ToolPreviewFieldDto { Label = f.Label, Value = f.Value, Multiline = f.Multiline, Role = f.Role }).ToList()
    };

    private static UserQuestionDto ToQuestionDto(UserQuestion question) => new()
    {
        Question = question.Question,
        MultiSelect = question.MultiSelect,
        Options = question.Options.Select(o => new UserQuestionOptionDto { Label = o.Label, Description = o.Description }).ToList()
    };

    /// <summary>Also what the Responses API ends with when an agent calls tools after its budget ran out.</summary>
    internal const string ToolRoundLimitText =
        "Stopped after too many tool calls in a row.";

    /// <summary>What a call gets when the user sent a new message instead of answering it.</summary>
    public const string NotRespondedText = "The user did not respond; the action was not performed.";

    /// <summary>Milliseconds on the message's timeline: the time earlier runs of the message took, plus this run's.</summary>
    private sealed class RunClock(long startMs)
    {
        private readonly Stopwatch _stopwatch = Stopwatch.StartNew();

        public long Now => startMs + _stopwatch.ElapsedMilliseconds;
    }

    private sealed class RoundOutcome
    {
        public bool Waiting { get; set; }
    }
}

/// <summary>A call a message waited on, and the answer it continues with.</summary>
public sealed record ResumedCall(ActivityEntry Entry, ResumeInput Input);
