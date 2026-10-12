using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Threading;
using Microsoft.Extensions.Logging;

namespace ChatUitReact.Server.Services.AiProviders;

using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

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
/// calls, and timings. The caller owns the activity object so a run that fails midway still
/// leaves the partial record behind.
/// </summary>
public sealed class AiConversationRunner
{
    /// <summary>
    /// How many times the model may call tools and be given the results before the run stops.
    /// Without a cap a model that keeps requesting tools would loop indefinitely.
    /// </summary>
    private const int MaxToolRounds = 8;

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
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var chatId = context.ChatId;
        var stopwatch = Stopwatch.StartNew();
        activity.Model = request.Model.ModelId;
        activity.Effort = request.Parameters.Effort;

        var provider = _providers.For(request.Endpoint.EndpointType);
        var conversation = provider.StartConversation(request);

        for (var round = 0; ; round++)
        {
            var toolCalls = new List<AiStreamEvent.ToolCall>();
            ActivityEntry? thinking = null;
            var thinkingText = new StringBuilder();

            await foreach (var streamEvent in conversation.StreamTurnAsync(cancellationToken: cancellationToken))
            {
                switch (streamEvent)
                {
                    case AiStreamEvent.Text text when !string.IsNullOrEmpty(text.Delta):
                        CloseThinking();
                        yield return new ChatStreamChunk { Kind = ChatStreamChunkKind.Text, Text = text.Delta, ElapsedMs = stopwatch.ElapsedMilliseconds };
                        break;
                    case AiStreamEvent.Thinking delta when !string.IsNullOrEmpty(delta.Delta):
                        if (thinking == null)
                        {
                            thinking = new ActivityEntry { Type = ActivityEntryType.Thinking, StartedMs = stopwatch.ElapsedMilliseconds };
                            activity.Entries.Add(thinking);
                        }

                        thinkingText.Append(delta.Delta);
                        thinking.Text = thinkingText.ToString();
                        yield return new ChatStreamChunk { Kind = ChatStreamChunkKind.Thinking, Text = delta.Delta, ElapsedMs = stopwatch.ElapsedMilliseconds };
                        break;
                    case AiStreamEvent.ThinkingBreak when thinking != null && thinkingText.Length > 0:
                        // Summary parts arrive without separators; a paragraph break keeps them readable.
                        const string ParagraphBreak = "\n\n";
                        if (!thinkingText.ToString().EndsWith(ParagraphBreak))
                        {
                            thinkingText.Append(ParagraphBreak);
                            thinking.Text = thinkingText.ToString();
                            yield return new ChatStreamChunk { Kind = ChatStreamChunkKind.Thinking, Text = ParagraphBreak, ElapsedMs = stopwatch.ElapsedMilliseconds };
                        }
                        break;
                    case AiStreamEvent.ToolCall call:
                        toolCalls.Add(call);
                        break;
                }
            }

            CloseThinking();

            if (toolCalls.Count == 0)
            {
                break;
            }

            if (round >= MaxToolRounds)
            {
                _logger.LogWarning(
                    "Stopping chat {ChatId} after {Rounds} tool rounds; the model kept requesting tools.",
                    chatId, MaxToolRounds);
                yield return new ChatStreamChunk { Kind = ChatStreamChunkKind.Text, Text = $"\n_{ToolRoundLimitText}_\n", ElapsedMs = stopwatch.ElapsedMilliseconds };
                break;
            }

            activity.ToolRounds++;
            var results = new List<AiToolResult>(toolCalls.Count);

            foreach (var call in toolCalls)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var tool = request.Tools.FirstOrDefault(t => t.Id == call.FunctionName);

                var entry = new ActivityEntry
                {
                    Type = ActivityEntryType.Tool,
                    StartedMs = stopwatch.ElapsedMilliseconds,
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
                    var unknown = ToolResult.Error($"Unknown tool: {call.FunctionName}");
                    yield return CompleteEntry(entry, unknown, ToolCallStatus.Error, results, call.Id, stopwatch.ElapsedMilliseconds);
                    continue;
                }

                await foreach (var evt in _toolExecutor.ExecuteAsync(tool, call, context, cancellationToken))
                {
                    var elapsed = stopwatch.ElapsedMilliseconds;
                    switch (evt)
                    {
                        case ToolExecutionEvent.ConfirmationRequested confirmation:
                            entry.Status = ToolCallStatus.AwaitingConfirmation;
                            entry.Preview = ToPreviewDto(confirmation.Preview);
                            yield return new ChatStreamChunk
                            {
                                Kind = ChatStreamChunkKind.ToolConfirmationRequested,
                                ElapsedMs = elapsed,
                                ToolCallId = call.Id,
                                ToolName = call.FunctionName,
                                ArgumentsJson = entry.ArgumentsJson,
                                Preview = entry.Preview,
                                Status = entry.Status,
                                TimeoutMs = (long)confirmation.Timeout.TotalMilliseconds
                            };
                            break;

                        case ToolExecutionEvent.ClientCallRequested clientCall:
                            entry.Status = ToolCallStatus.AwaitingClient;
                            yield return new ChatStreamChunk
                            {
                                Kind = ChatStreamChunkKind.ToolClientCallRequested,
                                ElapsedMs = elapsed,
                                ToolCallId = call.Id,
                                ToolName = call.FunctionName,
                                ArgumentsJson = clientCall.ArgumentsJson,
                                Status = entry.Status,
                                TimeoutMs = (long)clientCall.Timeout.TotalMilliseconds
                            };
                            break;

                        case ToolExecutionEvent.StatusChanged status:
                            entry.Status = status.Status;
                            if (status.ArgumentsJson != null)
                            {
                                entry.ArgumentsJson = status.ArgumentsJson;
                            }

                            yield return new ChatStreamChunk
                            {
                                Kind = ChatStreamChunkKind.ToolStatus,
                                ElapsedMs = elapsed,
                                ToolCallId = call.Id,
                                ToolName = call.FunctionName,
                                ArgumentsJson = status.ArgumentsJson,
                                Status = entry.Status
                            };
                            break;

                        case ToolExecutionEvent.Completed completed:
                            yield return CompleteEntry(entry, completed.Result, completed.Status, results, call.Id, elapsed);
                            break;
                    }
                }
            }

            conversation.AppendToolResults(results);

            void CloseThinking()
            {
                if (thinking == null)
                {
                    return;
                }

                thinking.EndedMs = stopwatch.ElapsedMilliseconds;
                thinking = null;
                thinkingText.Clear();
            }
        }

        Finish(activity, stopwatch.ElapsedMilliseconds);
        yield return new ChatStreamChunk { Kind = ChatStreamChunkKind.Done, ElapsedMs = activity.TotalMs, Activity = activity };
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
                // Nothing pending survives the run; history only holds terminal states.
                entry.Status = entry.Status is ToolCallStatus.AwaitingConfirmation or ToolCallStatus.AwaitingClient
                    ? ToolCallStatus.Timeout
                    : ToolCallStatus.Error;
                entry.IsError = true;
            }
        }

        activity.TotalMs = totalMs;
        activity.ThinkingMs = activity.Entries
            .Where(entry => entry.Type == ActivityEntryType.Thinking)
            .Sum(entry => entry.EndedMs!.Value - entry.StartedMs);
        activity.ToolMs = activity.Entries
            .Where(entry => entry.Type == ActivityEntryType.Tool)
            .Sum(entry => entry.EndedMs!.Value - entry.StartedMs);
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

        results.Add(new AiToolResult(toolCallId, result.Content, result.IsError));

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
        Fields = preview.Fields.Select(f => new ToolPreviewFieldDto { Label = f.Label, Value = f.Value, Multiline = f.Multiline }).ToList()
    };

    /// <summary>Also what the Responses API ends with when an agent calls tools after its budget ran out.</summary>
    internal const string ToolRoundLimitText =
        "Stopped after too many tool calls in a row.";
}
