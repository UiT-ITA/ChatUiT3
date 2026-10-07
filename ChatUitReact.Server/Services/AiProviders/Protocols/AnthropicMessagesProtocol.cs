using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Anthropic;
using Anthropic.Models.Messages;
using Microsoft.Extensions.Logging;

namespace ChatUitReact.Server.Services.AiProviders.Protocols;

using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.TokenCounting;
using ChatUitReact.Server.Services.Tools;
using DomainChatMessage = ChatUitReact.Server.Models.ChatMessage;

/// <summary>
/// Anthropic Messages API (Claude). Differs from the OpenAI protocols in ways this adapter
/// absorbs so nothing above it has to care:
///
/// <list type="bullet">
/// <item>the system prompt is a top-level parameter, not a leading message;</item>
/// <item><c>max_tokens</c> is required on every request;</item>
/// <item>turns must start with a user message and alternate roles;</item>
/// <item>tool results go in a following <em>user</em> turn, not attached to the assistant turn;</item>
/// <item>temperature is 0–1 here, where Azure allows 0–2.</item>
/// </list>
/// </summary>
public sealed class AnthropicMessagesProtocol : IApiProtocol
{
    private const int NamingTokenBudget = 100;
    private const int NamingReasoningTokenBudget = 2_000;

    private readonly ILogger<AnthropicMessagesProtocol> _logger;

    public AnthropicMessagesProtocol(ILogger<AnthropicMessagesProtocol> logger)
    {
        _logger = logger;
    }

    public ApiProtocol Protocol => ApiProtocol.AnthropicMessages;

    public IAiConversation StartConversation(AiRequest request, ProtocolTarget target)
    {
        var messages = BuildMessages(request, out var lastToolUseTurnHasThinking);
        return new Conversation(request, target, messages, allowThinking: lastToolUseTurnHasThinking, _logger);
    }

    public async Task<string> GenerateChatNameAsync(AiRequest request, ProtocolTarget target, CancellationToken cancellationToken = default)
    {
        var parameters = BuildParams(
            request,
            BuildMessages(request),
            request.Parameters.ReasoningActive
                ? Math.Min(NamingReasoningTokenBudget, request.Parameters.MaxOutputTokens)
                : NamingTokenBudget,
            includeTools: false);

        using var client = CreateClient(target);
        var message = await client.Messages.Create(parameters, cancellationToken);

        var text = new StringBuilder();
        foreach (var block in message.Content)
        {
            if (block.TryPickText(out var textBlock))
            {
                text.Append(textBlock!.Text);
            }
        }

        return text.ToString().Trim();
    }

    /// <summary>
    /// A new client for each call, built from the target as it is right now. Endpoints are
    /// edited in the admin panel while the server runs, so a client kept between calls would
    /// go on using the URL and key it was created with until the next restart.
    /// </summary>
    private static IAnthropicClient CreateClient(ProtocolTarget target)
    {
        var client = new AnthropicClient { ApiKey = target.ApiKey };

        // A null URL means "the default Anthropic API" rather than a misconfiguration to
        // reject; the SDK appends /v1/messages to whatever base it is given.
        return string.IsNullOrWhiteSpace(target.BaseUrl)
            ? client
            : client.WithOptions(options => options with { BaseUrl = target.BaseUrl });
    }

    private static MessageCreateParams BuildParams(
        AiRequest request,
        List<MessageParam> messages,
        int maxTokens,
        bool includeTools,
        bool allowThinking = true,
        bool allowToolCalls = true)
    {
        var effort = MapEffort(request.Parameters.Effort);

#pragma warning disable CS0618 // Temperature is obsolete SDK-wide because models after Opus 4.6
        // reject it; it is still valid on older ones, and the capability decides which is which.
        return new MessageCreateParams
        {
            Model = request.Model.ModelId,
            // Required by Anthropic on every request, which is why the resolver always
            // produces a concrete value rather than an optional one.
            MaxTokens = maxTokens,
            Messages = messages,
            // Top-level, not a leading message — the difference AiRequest.SystemPrompt exists for.
            System = string.IsNullOrEmpty(request.SystemPrompt)
                ? null
                : (MessageCreateParamsSystem)request.SystemPrompt,
            // Anthropic's range is 0-1; the assistant slider is shared with Azure, which allows 0-2.
            Temperature = request.Parameters.Temperature.HasValue
                ? Math.Clamp(request.Parameters.Temperature.Value, 0f, 1f)
                : null,
            OutputConfig = effort.HasValue ? new OutputConfig { Effort = effort.Value } : null,
            // Adaptive thinking is the only mode current Claude models accept. "summarized"
            // has to be explicit: models from Opus 4.7 on default to "omitted", which returns
            // thinking blocks with empty text. The raw chain of thought is never returned.
            Thinking = request.Parameters.ReasoningActive && allowThinking
                ? (ThinkingConfigParam)new ThinkingConfigAdaptive { Display = Display.Summarized }
                : null,
            Tools = includeTools && request.Tools.Count > 0
                ? request.Tools.Select(tool => new ToolUnion(ToAnthropicTool(tool))).ToList()
                : null,
            ToolChoice = includeTools && request.Tools.Count > 0 && !allowToolCalls
                ? (ToolChoice)new ToolChoiceNone()
                : null
        };
#pragma warning restore CS0618
    }

    /// <summary>
    /// Effort is how thinking depth is expressed on Claude models; a fixed thinking budget
    /// is rejected with a 400. "None" maps to no effort at all rather than to an explicit
    /// "disabled", because disabling thinking is itself rejected above high effort; omitting
    /// it lets the model use its own default.
    /// </summary>
    private static Effort? MapEffort(ReasoningEffort effort) => effort switch
    {
        ReasoningEffort.Low => Effort.Low,
        ReasoningEffort.Medium => Effort.Medium,
        ReasoningEffort.High => Effort.High,
        ReasoningEffort.XHigh => Effort.Xhigh,
        ReasoningEffort.Max => Effort.Max,
        _ => null
    };

    private static Tool ToAnthropicTool(ITool tool)
    {
        // The schema is shared with the OpenAI adapters; only the container type differs.
        var schema = JsonSerializer.SerializeToElement(tool.ParametersSchema);
        var raw = schema.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.Clone());

        return new Tool
        {
            Name = tool.Id,
            Description = tool.Description,
            InputSchema = InputSchema.FromRawUnchecked(raw)
        };
    }

    /// <summary>
    /// Normalises the stored chat into what Anthropic accepts: a leading user turn with
    /// strictly alternating roles. Our chats can break both rules — a regenerate or a failed
    /// generation can leave two assistant messages in a row — so turns are merged rather
    /// than sent as-is and rejected.
    /// </summary>
    internal List<MessageParam> BuildMessages(AiRequest request) => BuildMessages(request, out _);

    /// <param name="lastToolUseTurnHasThinking">
    /// False when the last assistant turn called tools but carries no thinking block (the client
    /// dropped it, or it came from another model). With thinking on, Anthropic rejects such a
    /// history, so the conversation then runs without it.
    /// </param>
    private List<MessageParam> BuildMessages(AiRequest request, out bool lastToolUseTurnHasThinking)
    {
        var turns = new List<(Role Role, List<ContentBlockParam> Blocks)>();
        lastToolUseTurnHasThinking = true;

        void Add(Role role, List<ContentBlockParam> content)
        {
            if (content.Count == 0)
            {
                return;
            }

            if (turns.Count > 0 && turns[^1].Role == role)
            {
                turns[^1].Blocks.AddRange(content);
                return;
            }

            turns.Add((role, content));
        }

        foreach (var segment in AiInputSegment.Split(request.Messages, Protocol, request.Model.Id))
        {
            switch (segment)
            {
                case AiInputSegment.Message message:
                    // Anthropic has no mid-conversation system role, so such a message is folded
                    // into the user turn rather than dropped.
                    Add(Role.User, BuildContent(message.Value, request.Parameters.AllowImages));
                    break;
                case AiInputSegment.AssistantTurn { IsPlainText: true } turn:
                    foreach (var message in turn.Messages)
                    {
                        Add(Role.Assistant, BuildContent(message, request.Parameters.AllowImages));
                    }

                    lastToolUseTurnHasThinking = true;
                    break;
                case AiInputSegment.AssistantTurn turn:
                    // Thinking blocks first, unchanged and with their signatures, then text,
                    // then tool_use: the order the model produced them in.
                    var blocks = new List<ContentBlockParam>();
                    foreach (var state in turn.Reasoning)
                    {
                        blocks.AddRange(ThinkingBlocksOf(state));
                    }

                    var hasThinking = blocks.Count > 0;
                    foreach (var message in turn.Messages)
                    {
                        blocks.AddRange(BuildContent(message, request.Parameters.AllowImages));
                    }

                    foreach (var call in turn.ToolCalls)
                    {
                        blocks.Add(new ToolUseBlockParam { ID = call.Id, Name = call.Name, Input = ParseArguments(call.ArgumentsJson, call.Name, _logger) });
                    }

                    lastToolUseTurnHasThinking = turn.ToolCalls.Count == 0 || hasThinking;

                    Add(Role.Assistant, blocks);
                    break;
                case AiInputSegment.ToolResults results:
                    Add(Role.User, results.Results
                        .Select(result => (ContentBlockParam)BuildToolResult(result, request.Parameters.AllowImages))
                        .ToList());
                    break;
            }
        }

        // The first turn must be a user turn.
        while (turns.Count > 0 && turns[0].Role == Role.Assistant)
        {
            turns.RemoveAt(0);
        }

        if (turns.Count == 0)
        {
            turns.Add((Role.User, new List<ContentBlockParam> { new TextBlockParam { Text = "(no message)" } }));
        }

        return turns
            .Select(turn => new MessageParam { Role = turn.Role, Content = turn.Blocks })
            .ToList();
    }

    private List<ContentBlockParam> BuildContent(DomainChatMessage message, bool allowImages)
    {
        var blocks = new List<ContentBlockParam>();

        if (!string.IsNullOrEmpty(message.Content))
        {
            blocks.Add(new TextBlockParam { Text = message.Content });
        }

        if (message.Files == null)
        {
            return blocks;
        }

        foreach (var file in message.Files)
        {
            AppendFile(file, blocks, allowImages);
        }

        return blocks;
    }

    private void AppendFile(ChatFile file, List<ContentBlockParam> blocks, bool allowImages)
    {
        try
        {
            blocks.Add(new TextBlockParam { Text = $"\n--- ATTACHED FILE: {file.SourceFilename} ---\n" });

            for (var i = 0; i < file.Chunks.Count; i++)
            {
                var chunk = file.Chunks[i];
                blocks.Add(new TextBlockParam { Text = $"[File Part {i + 1} of {file.Chunks.Count}]\n" });

                if (chunk.Type.Equals("text", StringComparison.OrdinalIgnoreCase))
                {
                    blocks.Add(new TextBlockParam { Text = (chunk.Text ?? string.Empty) + "\n" });
                }
                else if (chunk.Type.Equals("image", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(chunk.Base64))
                {
                    if (!allowImages)
                    {
                        blocks.Add(new TextBlockParam { Text = "[Image omitted: this model cannot read images]\n" });
                        continue;
                    }

                    blocks.Add(new ImageBlockParam
                    {
                        // Anthropic validates the media type, so it comes from the chunk
                        // rather than being assumed to be jpeg.
                        Source = new Base64ImageSource
                        {
                            Data = chunk.Base64!,
                            MediaType = ResolveMediaType(chunk.Format)
                        }
                    });
                }
            }

            blocks.Add(new TextBlockParam { Text = $"--- END OF FILE: {file.SourceFilename} ---\n\n" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing file {FileName}", file.SourceFilename);
            blocks.Add(new TextBlockParam { Text = $"\n--- ERROR: Could not process file {file.SourceFilename} ---\n" });
        }
    }

    /// <summary>The payload is the turn's thinking blocks, as <see cref="Conversation"/> emits them.</summary>
    private IEnumerable<ContentBlockParam> ThinkingBlocksOf(AiInputItem.ReasoningState state)
    {
        if (state.Payload.ValueKind != JsonValueKind.Array)
        {
            yield break;
        }

        foreach (var block in state.Payload.EnumerateArray())
        {
            var type = block.TryGetProperty("type", out var t) ? t.GetString() : null;
            if (type == ThinkingType && block.TryGetProperty("signature", out var signature))
            {
                yield return new ThinkingBlockParam
                {
                    Thinking = block.TryGetProperty("thinking", out var thinking) ? thinking.GetString() ?? string.Empty : string.Empty,
                    Signature = signature.GetString() ?? string.Empty
                };
            }
            else if (type == RedactedThinkingType && block.TryGetProperty("data", out var data))
            {
                yield return new RedactedThinkingBlockParam { Data = data.GetString() ?? string.Empty };
            }
            else
            {
                _logger.LogWarning("Dropping an unreadable thinking block from replayed reasoning state");
            }
        }
    }

    private const string ThinkingType = "thinking";
    private const string RedactedThinkingType = "redacted_thinking";

    private static Dictionary<string, JsonElement> ParseArguments(string json, string toolName, ILogger logger)
    {
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json)
                   ?? new Dictionary<string, JsonElement>();
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Could not parse streamed arguments for tool {ToolName}", toolName);
            return new Dictionary<string, JsonElement>();
        }
    }

    /// <summary>
    /// A tool result block. Images a tool returned go into its content next to the text; a model
    /// that cannot read images gets the note instead.
    /// </summary>
    private static ToolResultBlockParam BuildToolResult(AiInputItem.ToolResult result, bool allowImages)
    {
        if (result.Images is not { Count: > 0 } images)
        {
            return new ToolResultBlockParam { ToolUseID = result.ToolCallId, Content = result.Content, IsError = result.IsError };
        }

        if (!allowImages)
        {
            return new ToolResultBlockParam { ToolUseID = result.ToolCallId, Content = $"{result.Content}\n{MessageParts.ImageOmittedText}", IsError = result.IsError };
        }

        var blocks = new List<Block> { new TextBlockParam { Text = result.Content } };
        blocks.AddRange(images.Select(image => (Block)new ImageBlockParam
        {
            Source = new Base64ImageSource { Data = image.Base64, MediaType = ResolveToolImageMediaType(image.MediaType) }
        }));
        return new ToolResultBlockParam { ToolUseID = result.ToolCallId, Content = blocks, IsError = result.IsError };
    }

    /// <summary>The media types the Responses API accepts in tool output (png, jpeg, gif, webp).</summary>
    private static MediaType ResolveToolImageMediaType(string mediaType) => mediaType switch
    {
        "image/png" => MediaType.ImagePng,
        "image/gif" => MediaType.ImageGif,
        "image/webp" => MediaType.ImageWebP,
        _ => MediaType.ImageJpeg
    };

    private static MediaType ResolveMediaType(string? format)
    {
        var normalized = (format ?? string.Empty).Trim().ToLowerInvariant().Replace("image/", string.Empty);

        return normalized switch
        {
            "png" => MediaType.ImagePng,
            "gif" => MediaType.ImageGif,
            // The SDK's enum covers jpeg/png/gif only, so anything else is declared as jpeg.
            _ => MediaType.ImageJpeg
        };
    }

    /// <summary>
    /// Holds the conversation as Anthropic message params. Tool results are appended as a
    /// new user turn containing tool_result blocks, which is where Anthropic expects them.
    /// </summary>
    private sealed class Conversation : IAiConversation
    {
        private readonly AiRequest _request;
        private readonly ProtocolTarget _target;
        private readonly List<MessageParam> _messages;
        private readonly bool _allowThinking;
        private readonly ILogger _logger;

        /// <param name="allowThinking">
        /// False when the replayed history ends in a tool-use turn without its thinking state.
        /// Every turn of this conversation then runs without thinking, since each one it adds is
        /// again a tool-use turn without a thinking block.
        /// </param>
        public Conversation(AiRequest request, ProtocolTarget target, List<MessageParam> messages, bool allowThinking, ILogger logger)
        {
            _request = request;
            _target = target;
            _messages = messages;
            _allowThinking = allowThinking;
            _logger = logger;
        }

        public async IAsyncEnumerable<AiStreamEvent> StreamTurnAsync(
            bool allowToolCalls = true,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var parameters = BuildParams(_request, _messages, _request.Parameters.MaxOutputTokens, includeTools: true, _allowThinking, allowToolCalls);

            using var client = CreateClient(_target);

            // Content blocks arrive as a start event, deltas, and a stop event, all keyed by
            // index. They are kept in index order because the turn is replayed to the model
            // as-is on the next tool round: thinking blocks must come back unchanged, with
            // their signatures, ahead of the text and tool_use blocks they precede.
            var blocks = new SortedDictionary<long, PendingBlock>();

            await foreach (var streamEvent in client.Messages.CreateStreaming(parameters, cancellationToken))
            {
                if (streamEvent.TryPickContentBlockStart(out var start) && start != null)
                {
                    if (start.ContentBlock.TryPickToolUse(out var toolUse) && toolUse != null)
                    {
                        blocks[start.Index] = new PendingBlock(PendingBlockKind.ToolUse) { Id = toolUse.ID, Name = toolUse.Name };
                    }
                    else if (start.ContentBlock.TryPickThinking(out var thinkingBlock) && thinkingBlock != null)
                    {
                        blocks[start.Index] = new PendingBlock(PendingBlockKind.Thinking) { Signature = thinkingBlock.Signature };
                    }
                    else if (start.ContentBlock.TryPickRedactedThinking(out var redacted) && redacted != null)
                    {
                        blocks[start.Index] = new PendingBlock(PendingBlockKind.RedactedThinking) { Data = redacted.Data };
                    }
                    else if (start.ContentBlock.TryPickText(out _))
                    {
                        blocks[start.Index] = new PendingBlock(PendingBlockKind.Text);
                    }

                    continue;
                }

                if (streamEvent.TryPickContentBlockStop(out var stop) && stop != null)
                {
                    if (blocks.TryGetValue(stop.Index, out var stopped) && stopped.Kind == PendingBlockKind.Thinking)
                    {
                        yield return new AiStreamEvent.ThinkingBreak();
                    }

                    continue;
                }

                if (streamEvent.TryPickContentBlockDelta(out var delta) && delta != null
                    && blocks.TryGetValue(delta.Index, out var block))
                {
                    if (delta.Delta.TryPickText(out var textDelta) && textDelta != null)
                    {
                        block.Content.Append(textDelta.Text);
                        yield return new AiStreamEvent.Text(textDelta.Text);
                    }
                    else if (delta.Delta.TryPickThinking(out var thinkingDelta) && thinkingDelta != null)
                    {
                        block.Content.Append(thinkingDelta.Thinking);
                        yield return new AiStreamEvent.Thinking(thinkingDelta.Thinking);
                    }
                    else if (delta.Delta.TryPickSignature(out var signatureDelta) && signatureDelta != null)
                    {
                        block.Signature = signatureDelta.Signature;
                    }
                    else if (delta.Delta.TryPickInputJson(out var jsonDelta) && jsonDelta != null)
                    {
                        block.Content.Append(jsonDelta.PartialJson);
                    }
                }
            }

            var assistantBlocks = new List<ContentBlockParam>();
            var toolCalls = new List<AiStreamEvent.ToolCall>();
            var thinkingState = new List<Dictionary<string, string>>();

            foreach (var block in blocks.Values)
            {
                switch (block.Kind)
                {
                    case PendingBlockKind.Text when block.Content.Length > 0:
                        assistantBlocks.Add(new TextBlockParam { Text = block.Content.ToString() });
                        break;
                    case PendingBlockKind.Thinking:
                        assistantBlocks.Add(new ThinkingBlockParam
                        {
                            Thinking = block.Content.ToString(),
                            Signature = block.Signature ?? string.Empty
                        });
                        thinkingState.Add(new() { ["type"] = ThinkingType, ["thinking"] = block.Content.ToString(), ["signature"] = block.Signature ?? string.Empty });
                        break;
                    case PendingBlockKind.RedactedThinking:
                        assistantBlocks.Add(new RedactedThinkingBlockParam { Data = block.Data ?? string.Empty });
                        thinkingState.Add(new() { ["type"] = RedactedThinkingType, ["data"] = block.Data ?? string.Empty });
                        break;
                    case PendingBlockKind.ToolUse:
                        var arguments = block.Content.Length > 0 ? block.Content.ToString() : "{}";
                        assistantBlocks.Add(new ToolUseBlockParam
                        {
                            ID = block.Id!,
                            Name = block.Name!,
                            Input = ParseArguments(arguments, block.Name!, _logger)
                        });
                        toolCalls.Add(new AiStreamEvent.ToolCall(block.Id!, block.Name!, arguments));
                        break;
                }
            }

            // The assistant turn carrying the calls must be in history before the results,
            // or the follow-up request is rejected for unmatched tool_use ids.
            if (assistantBlocks.Count > 0)
            {
                _messages.Add(new MessageParam { Role = Role.Assistant, Content = assistantBlocks });
            }

            if (thinkingState.Count > 0)
            {
                yield return new AiStreamEvent.ReasoningState(JsonSerializer.SerializeToElement(thinkingState));
            }

            foreach (var toolCall in toolCalls)
            {
                yield return toolCall;
            }
        }

        public void AppendToolResults(IReadOnlyList<AiToolResult> results)
        {
            var blocks = new List<ContentBlockParam>();

            foreach (var result in results)
            {
                blocks.Add(new ToolResultBlockParam
                {
                    ToolUseID = result.ToolCallId,
                    Content = result.Content,
                    IsError = result.IsError
                });
            }

            // Unlike OpenAI's per-result tool messages, Anthropic wants every result for a
            // turn in a single following user message.
            _messages.Add(new MessageParam { Role = Role.User, Content = blocks });
        }

        private enum PendingBlockKind
        {
            Text,
            Thinking,
            RedactedThinking,
            ToolUse
        }

        /// <summary>A content block being assembled from stream events.</summary>
        private sealed class PendingBlock
        {
            public PendingBlock(PendingBlockKind kind)
            {
                Kind = kind;
            }

            public PendingBlockKind Kind { get; }

            /// <summary>Text, thinking summary, or partial tool input JSON, depending on the kind.</summary>
            public StringBuilder Content { get; } = new();

            public string? Id { get; set; }

            public string? Name { get; set; }

            public string? Signature { get; set; }

            public string? Data { get; set; }
        }
    }
}
