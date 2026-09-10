using System;
using System.ClientModel;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using OpenAI;
using OpenAI.Chat;

// JsonPatch, the SDK's access to fields it has no property for, is [Experimental], and so
// is reasoning_effort on Chat Completions.
#pragma warning disable SCME0001
#pragma warning disable OPENAI001

namespace ChatUitReact.Server.Services.AiProviders.Protocols;

using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.TokenCounting;
using ChatUitReact.Server.Services.Tools;
using DomainChatMessage = ChatUitReact.Server.Models.ChatMessage;
using OpenAiChatMessage = OpenAI.Chat.ChatMessage;
using OpenAiChatTool = OpenAI.Chat.ChatTool;

/// <summary>
/// OpenAI Chat Completions, as served for DeepSeek and older OpenAI models. Two things the
/// SDK has no property for are read and written through its JSON patch:
///
/// <list type="bullet">
/// <item><c>delta.reasoning_content</c>, where DeepSeek's chain of thought arrives on hosts
/// that expose it as a field. Hosts that instead inline it as <c>&lt;think&gt;</c> tags in
/// <c>content</c> are covered by <see cref="ThinkTagSplitter"/>; both feed the same
/// <see cref="AiStreamEvent.Thinking"/> events.</item>
/// <item><c>reasoning_content</c> on the assistant turn replayed on a tool round. DeepSeek
/// returns 400 when a request carries tools and a previous turn's reasoning is missing.</item>
/// </list>
/// </summary>
public sealed class OpenAiChatCompletionsProtocol : IApiProtocol
{
    private static readonly byte[] ReasoningContentDeltaPath = "$.choices[0].delta.reasoning_content"u8.ToArray();
    private static readonly byte[] ReasoningContentPath = "$.reasoning_content"u8.ToArray();

    private readonly ILogger<OpenAiChatCompletionsProtocol> _logger;

    public OpenAiChatCompletionsProtocol(ILogger<OpenAiChatCompletionsProtocol> logger)
    {
        _logger = logger;
    }

    public ApiProtocol Protocol => ApiProtocol.OpenAiChatCompletions;

    public IAiConversation StartConversation(AiRequest request, ProtocolTarget target)
    {
        return new Conversation(request, target, BuildMessages(request), _logger);
    }

    public async Task<string> GenerateChatNameAsync(AiRequest request, ProtocolTarget target, CancellationToken cancellationToken = default)
    {
        var options = BuildOptions(request, includeTools: false);
        var completion = await CreateClient(request, target).CompleteChatAsync(BuildMessages(request), options, cancellationToken);

        var text = string.Concat(completion.Value.Content
            .Where(part => part.Kind == ChatMessageContentPartKind.Text)
            .Select(part => part.Text));

        // A model that reasons inline would otherwise hand its whole deliberation back as the name.
        return ThinkTagSplitter.StripThinkBlocks(text).Trim();
    }

    /// <summary>
    /// A new client for each call, built from the target as it is right now. Endpoints are
    /// edited in the admin panel while the server runs, so a client kept between calls would
    /// go on using the URL and key it was created with until the next restart.
    /// </summary>
    private static ChatClient CreateClient(AiRequest request, ProtocolTarget target)
    {
        if (string.IsNullOrWhiteSpace(target.BaseUrl))
        {
            throw new InvalidOperationException("OpenAI Chat Completions needs a base URL; the host provider did not supply one.");
        }

        return new ChatClient(
            model: request.Model.ModelId,
            credential: new ApiKeyCredential(target.ApiKey),
            options: new OpenAIClientOptions { Endpoint = new Uri(target.BaseUrl) });
    }

    private static ChatCompletionOptions BuildOptions(AiRequest request, bool includeTools)
    {
        var parameters = request.Parameters;
        var capabilities = request.Model.Capabilities;

        var options = new ChatCompletionOptions
        {
            // Sent as max_completion_tokens, which is the current name; max_tokens is deprecated here.
            MaxOutputTokenCount = parameters.MaxOutputTokens
        };

        if (parameters.Temperature.HasValue)
        {
            options.Temperature = parameters.Temperature.Value;
        }

        // reasoning_effort is sent only when there is a level to choose. A one-level ladder
        // means the model always reasons and offers no control — DeepSeek on Foundry documents
        // no toggle — and a parameter never sent cannot be rejected.
        if (capabilities.SupportsReasoning && capabilities.SupportedEfforts.Count > 1)
        {
            options.ReasoningEffortLevel = parameters.Effort switch
            {
                ReasoningEffort.None => ChatReasoningEffortLevel.None,
                ReasoningEffort.Low => ChatReasoningEffortLevel.Low,
                ReasoningEffort.Medium => ChatReasoningEffortLevel.Medium,
                ReasoningEffort.High => ChatReasoningEffortLevel.High,
                // The SDK names no levels above high; custom values pass through as-is.
                ReasoningEffort.XHigh => new ChatReasoningEffortLevel("xhigh"),
                _ => new ChatReasoningEffortLevel("max")
            };
        }

        if (includeTools)
        {
            foreach (var tool in request.Tools)
            {
                options.Tools.Add(OpenAiChatTool.CreateFunctionTool(
                    tool.FunctionName,
                    tool.Description,
                    BinaryData.FromString(ToolSchemaJson.Build(tool))));
            }
        }

        return options;
    }

    private static List<OpenAiChatMessage> BuildMessages(AiRequest request)
    {
        var messages = new List<OpenAiChatMessage>();

        // Chat Completions has no top-level instructions: the system prompt leads the messages.
        if (!string.IsNullOrEmpty(request.SystemPrompt))
        {
            messages.Add(new SystemChatMessage(request.SystemPrompt));
        }

        foreach (var message in request.Messages)
        {
            switch (message.Role)
            {
                case AiChatRole.User:
                    messages.Add(BuildUserMessage(message, request.Parameters.AllowImages));
                    break;
                case AiChatRole.Assistant:
                    // A failed or cancelled generation can leave an empty assistant message,
                    // which this API rejects.
                    if (!string.IsNullOrEmpty(message.Content))
                    {
                        messages.Add(new AssistantChatMessage(message.Content));
                    }
                    break;
                case AiChatRole.System:
                    messages.Add(new SystemChatMessage(message.Content));
                    break;
            }
        }

        return messages;
    }

    private static UserChatMessage BuildUserMessage(DomainChatMessage message, bool allowImages)
    {
        if (message.Files == null || message.Files.Count == 0)
        {
            return new UserChatMessage(message.Content);
        }

        var parts = new List<ChatMessageContentPart>();
        foreach (var part in MessageParts.Build(message, allowImages))
        {
            switch (part)
            {
                case TextPart text:
                    parts.Add(ChatMessageContentPart.CreateTextPart(text.Text));
                    break;
                case ImagePart image:
                    parts.Add(ChatMessageContentPart.CreateImagePart(new Uri($"data:{image.MediaType};base64,{image.Base64}")));
                    break;
            }
        }

        return new UserChatMessage(parts);
    }

    /// <summary>
    /// Holds the conversation as a client-side message list. Each turn's assistant message —
    /// text, tool calls, and any reasoning received — is appended so tool rounds replay it.
    /// </summary>
    private sealed class Conversation : IAiConversation
    {
        private readonly AiRequest _request;
        private readonly ProtocolTarget _target;
        private readonly List<OpenAiChatMessage> _messages;
        private readonly ILogger _logger;

        public Conversation(AiRequest request, ProtocolTarget target, List<OpenAiChatMessage> messages, ILogger logger)
        {
            _request = request;
            _target = target;
            _messages = messages;
            _logger = logger;
        }

        public async IAsyncEnumerable<AiStreamEvent> StreamTurnAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var options = BuildOptions(_request, includeTools: true);
            var client = CreateClient(_request, _target);

            var turn = new TurnState();
            var toolCalls = new SortedDictionary<int, PendingToolCall>();

            await foreach (var update in client.CompleteChatStreamingAsync(_messages, options, cancellationToken).WithCancellation(cancellationToken))
            {
                if (update.Patch.TryGetValue(ReasoningContentDeltaPath, out string? reasoningDelta) && !string.IsNullOrEmpty(reasoningDelta))
                {
                    yield return turn.AcceptReasoning(reasoningDelta);
                }

                foreach (var part in update.ContentUpdate)
                {
                    if (part.Kind != ChatMessageContentPartKind.Text || string.IsNullOrEmpty(part.Text))
                    {
                        continue;
                    }

                    foreach (var streamEvent in turn.AcceptContent(part.Text))
                    {
                        yield return streamEvent;
                    }
                }

                foreach (var toolCallUpdate in update.ToolCallUpdates)
                {
                    if (!toolCalls.TryGetValue(toolCallUpdate.Index, out var pending))
                    {
                        pending = new PendingToolCall();
                        toolCalls[toolCallUpdate.Index] = pending;
                    }

                    if (!string.IsNullOrEmpty(toolCallUpdate.ToolCallId))
                    {
                        pending.Id = toolCallUpdate.ToolCallId;
                    }

                    if (!string.IsNullOrEmpty(toolCallUpdate.FunctionName))
                    {
                        pending.Name = toolCallUpdate.FunctionName;
                    }

                    if (toolCallUpdate.FunctionArgumentsUpdate is { IsEmpty: false })
                    {
                        pending.Arguments.Append(toolCallUpdate.FunctionArgumentsUpdate.ToString());
                    }
                }
            }

            foreach (var streamEvent in turn.Finish())
            {
                yield return streamEvent;
            }

            var calls = toolCalls.Values.Where(call => call.Id != null && call.Name != null).ToList();
            foreach (var dropped in toolCalls.Values.Except(calls))
            {
                _logger.LogWarning("Dropping an incomplete streamed tool call (id {Id}, name {Name})", dropped.Id, dropped.Name);
            }

            var text = turn.Content;
            AssistantChatMessage? assistant = null;
            if (calls.Count > 0)
            {
                assistant = new AssistantChatMessage(calls.Select(call =>
                    ChatToolCall.CreateFunctionToolCall(call.Id!, call.Name!, BinaryData.FromString(call.ArgumentsJson))));
                if (text.Length > 0)
                {
                    assistant.Content.Add(ChatMessageContentPart.CreateTextPart(text));
                }
            }
            else if (text.Length > 0)
            {
                assistant = new AssistantChatMessage(text);
            }

            // The assistant turn carrying the calls must be in history before the results.
            if (assistant != null)
            {
                // Only needed when tools are in play; without them DeepSeek ignores the field.
                if (_request.Tools.Count > 0 && turn.Reasoning.Length > 0)
                {
                    assistant.Patch.Set(ReasoningContentPath, turn.Reasoning);
                }

                _messages.Add(assistant);
            }

            foreach (var call in calls)
            {
                yield return new AiStreamEvent.ToolCall(call.Id!, call.Name!, call.ArgumentsJson);
            }
        }

        public void AppendToolResults(IReadOnlyList<AiToolResult> results)
        {
            foreach (var result in results)
            {
                _messages.Add(new ToolChatMessage(result.ToolCallId, result.Content));
            }
        }

        /// <summary>
        /// Routes a turn's deltas: reasoning from either source becomes Thinking, answer text
        /// becomes Text, and the first answer text after reasoning is preceded by one
        /// ThinkingBreak so the activity panel closes the thinking paragraph.
        /// </summary>
        private sealed class TurnState
        {
            private readonly ThinkTagSplitter _splitter = new();
            private readonly StringBuilder _reasoning = new();
            private readonly StringBuilder _content = new();
            private bool _thinkingOpen;

            public string Reasoning => _reasoning.ToString();

            public string Content => _content.ToString();

            public AiStreamEvent AcceptReasoning(string delta)
            {
                _reasoning.Append(delta);
                _thinkingOpen = true;
                return new AiStreamEvent.Thinking(delta);
            }

            public IEnumerable<AiStreamEvent> AcceptContent(string delta) => Emit(_splitter.Push(delta));

            public IEnumerable<AiStreamEvent> Finish() => Emit(_splitter.Flush());

            private IEnumerable<AiStreamEvent> Emit(IReadOnlyList<ThinkTagSplitter.Piece> pieces)
            {
                foreach (var piece in pieces)
                {
                    if (piece.IsThinking)
                    {
                        yield return AcceptReasoning(piece.Text);
                        continue;
                    }

                    if (_thinkingOpen)
                    {
                        _thinkingOpen = false;
                        yield return new AiStreamEvent.ThinkingBreak();
                    }

                    _content.Append(piece.Text);
                    yield return new AiStreamEvent.Text(piece.Text);
                }
            }
        }

        /// <summary>A tool call being assembled from indexed stream fragments.</summary>
        private sealed class PendingToolCall
        {
            public string? Id { get; set; }

            public string? Name { get; set; }

            public StringBuilder Arguments { get; } = new();

            /// <summary>A model that streams no argument bytes still called with an empty object.</summary>
            public string ArgumentsJson => Arguments.Length > 0 ? Arguments.ToString() : "{}";
        }
    }
}
