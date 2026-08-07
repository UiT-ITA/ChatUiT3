using System.Collections.Generic;
using System.Runtime.CompilerServices;
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

    public async IAsyncEnumerable<ChatResponseChunk> StreamAsync(
        AiRequest request,
        string userId,
        string chatId,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var provider = _providers.For(request.Endpoint.EndpointType);
        var conversation = provider.StartConversation(request);

        for (var round = 0; ; round++)
        {
            var toolCalls = new List<AiStreamEvent.ToolCall>();

            await foreach (var streamEvent in conversation.StreamTurnAsync(cancellationToken))
            {
                switch (streamEvent)
                {
                    case AiStreamEvent.Text text when !string.IsNullOrEmpty(text.Delta):
                        yield return new ChatResponseChunk { Content = text.Delta };
                        break;
                    case AiStreamEvent.ToolCall call:
                        toolCalls.Add(call);
                        break;
                }
            }

            if (toolCalls.Count == 0)
            {
                break;
            }

            if (round >= MaxToolRounds)
            {
                _logger.LogWarning(
                    "Stopping chat {ChatId} after {Rounds} tool rounds; the model kept requesting tools.",
                    chatId, MaxToolRounds);
                yield return new ChatResponseChunk { Content = $"\n_{ToolRoundLimitText}_\n" };
                break;
            }

            var results = new List<AiToolResult>(toolCalls.Count);

            foreach (var call in toolCalls)
            {
                cancellationToken.ThrowIfCancellationRequested();

                // The opening marker is emitted before the tool runs so the UI can show the
                // call while it is still in flight; the client parser tolerates an unclosed block.
                yield return new ChatResponseChunk { Content = $"\n<ToolCall>\n{call.FunctionName}({call.ArgumentsJson})\n" };

                var outcome = await ExecuteToolAsync(call, userId, chatId, cancellationToken);

                results.Add(new AiToolResult(call.Id, outcome.Content, outcome.IsError));
                yield return new ChatResponseChunk { Content = $"{outcome.Display}\n</ToolCall>\n" };
            }

            conversation.AppendToolResults(results);
        }

        yield return new ChatResponseChunk { Content = "", IsComplete = true };
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
