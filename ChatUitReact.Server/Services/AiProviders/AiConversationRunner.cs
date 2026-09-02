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
    private readonly IToolService _toolService;
    private readonly ILogger<AiConversationRunner> _logger;

    public AiConversationRunner(
        IAiProviderRegistry providers,
        IToolService toolService,
        ILogger<AiConversationRunner> logger)
    {
        _providers = providers;
        _toolService = toolService;
        _logger = logger;
    }

    public async IAsyncEnumerable<ChatStreamChunk> StreamAsync(
        AiRequest request,
        string userId,
        string chatId,
        MessageActivity activity,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
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

            await foreach (var streamEvent in conversation.StreamTurnAsync(cancellationToken))
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

                var entry = new ActivityEntry
                {
                    Type = ActivityEntryType.Tool,
                    StartedMs = stopwatch.ElapsedMilliseconds,
                    ToolCallId = call.Id,
                    ToolName = call.FunctionName,
                    ArgumentsJson = call.ArgumentsJson
                };
                activity.Entries.Add(entry);

                // Announced before the tool runs so the UI can show the call while it is in flight.
                yield return new ChatStreamChunk
                {
                    Kind = ChatStreamChunkKind.ToolStart,
                    ElapsedMs = entry.StartedMs,
                    ToolCallId = call.Id,
                    ToolName = call.FunctionName,
                    ArgumentsJson = call.ArgumentsJson
                };

                var outcome = await ExecuteToolAsync(call, userId, chatId, cancellationToken);

                entry.EndedMs = stopwatch.ElapsedMilliseconds;
                entry.Result = outcome.Display;
                entry.IsError = outcome.IsError;

                results.Add(new AiToolResult(call.Id, outcome.Content, outcome.IsError));
                yield return new ChatStreamChunk
                {
                    Kind = ChatStreamChunkKind.ToolEnd,
                    ElapsedMs = entry.EndedMs.Value,
                    ToolCallId = call.Id,
                    ToolName = call.FunctionName,
                    Result = outcome.Display,
                    IsError = outcome.IsError
                };
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
        }

        activity.TotalMs = totalMs;
        activity.ThinkingMs = activity.Entries
            .Where(entry => entry.Type == ActivityEntryType.Thinking)
            .Sum(entry => entry.EndedMs!.Value - entry.StartedMs);
        activity.ToolMs = activity.Entries
            .Where(entry => entry.Type == ActivityEntryType.Tool)
            .Sum(entry => entry.EndedMs!.Value - entry.StartedMs);
    }

    // Separate from the streaming loop because C# forbids `yield` inside a try/catch.
    private async Task<ToolOutcome> ExecuteToolAsync(
        AiStreamEvent.ToolCall call,
        string userId,
        string chatId,
        CancellationToken cancellationToken)
    {
        try
        {
            var context = _toolService.CreateToolContext(userId, chatId, call.Id);
            using var document = JsonDocument.Parse(call.ArgumentsJson);

            var result = await _toolService.ExecuteToolCallAsync(
                call.FunctionName, document.RootElement, context, cancellationToken);

            return new ToolOutcome(result, result, false);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // A cancelled run must stop here, not report a tool failure to a model that will
            // never be asked again.
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing tool {ToolName}", call.FunctionName);

            var message = $"Error: {ex.Message}";
            // The model is told the call failed so it can adapt rather than assume success.
            return new ToolOutcome(message, message, true);
        }
    }

    private const string ToolRoundLimitText =
        "Stopped after too many tool calls in a row.";

    private readonly record struct ToolOutcome(string Content, string Display, bool IsError);
}
