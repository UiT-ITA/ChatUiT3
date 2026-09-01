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

namespace ChatUitReact.Server.Services.AiProviders;

using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;
using DomainChatMessage = ChatUitReact.Server.Models.ChatMessage;

/// <summary>
/// Anthropic (Claude). Differs from the OpenAI providers in ways this adapter absorbs so
/// nothing above it has to care:
///
/// <list type="bullet">
/// <item>the system prompt is a top-level parameter, not a leading message;</item>
/// <item><c>max_tokens</c> is required on every request;</item>
/// <item>turns must start with a user message and alternate roles;</item>
/// <item>tool results go in a following <em>user</em> turn, not attached to the assistant turn;</item>
/// <item>temperature is 0–1 here, where Azure allows 0–2.</item>
/// </list>
/// </summary>
public sealed class AnthropicProvider : IAiProvider
{
    private const int NamingTokenBudget = 100;
    private const int NamingReasoningTokenBudget = 2_000;

    private readonly ILogger<AnthropicProvider> _logger;

    public AnthropicProvider(ILogger<AnthropicProvider> logger)
    {
        _logger = logger;
    }

    public EndpointType EndpointType => EndpointType.Anthropic;

    public IAiConversation StartConversation(AiRequest request)
    {
        return new Conversation(request, BuildMessages(request), _logger);
    }

    public async Task<string> GenerateChatNameAsync(AiRequest request, CancellationToken cancellationToken = default)
    {
        var parameters = BuildParams(
            request,
            BuildMessages(request),
            request.Parameters.ReasoningActive
                ? Math.Min(NamingReasoningTokenBudget, request.Parameters.MaxOutputTokens)
                : NamingTokenBudget,
            includeTools: false);

        using var client = CreateClient(request.Endpoint);
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
    /// A new client for each call, built from the endpoint row as it is right now. Endpoints
    /// are edited in the admin panel while the server runs, so a client kept between calls
    /// would go on using the URL and key it was created with until the next restart.
    /// </summary>
    private static IAnthropicClient CreateClient(ModelEndpoint endpoint)
    {
        var client = new AnthropicClient { ApiKey = endpoint.ApiKey };

        // Endpoints are admin-managed rows, so a blank URL means "the default Anthropic
        // API" rather than a misconfiguration to reject.
        return string.IsNullOrWhiteSpace(endpoint.Url)
            ? client
            : client.WithOptions(options => options with { BaseUrl = endpoint.Url });
    }

    private static MessageCreateParams BuildParams(
        AiRequest request,
        List<MessageParam> messages,
        int maxTokens,
        bool includeTools)
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
            Tools = includeTools && request.Tools.Count > 0
                ? request.Tools.Select(tool => new ToolUnion(ToAnthropicTool(tool))).ToList()
                : null
        };
#pragma warning restore CS0618
    }

    /// <summary>
    /// Effort is how thinking depth is expressed on current Claude models — the old fixed
    /// thinking budget was removed and now returns 400. "None" maps to no effort at all
    /// rather than to an explicit "disabled", because disabling thinking is itself rejected
    /// above high effort; omitting it lets the model use its own default.
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

    private static Tool ToAnthropicTool(ChatTool tool)
    {
        var properties = new Dictionary<string, JsonElement>();

        foreach (var parameter in tool.Parameters)
        {
            var schema = new Dictionary<string, object>
            {
                ["type"] = parameter.Type,
                ["description"] = parameter.Description
            };

            if (parameter.Enum != null && parameter.Enum.Length > 0)
            {
                schema["enum"] = parameter.Enum;
            }

            properties[parameter.Name] = JsonSerializer.SerializeToElement(schema);
        }

        return new Tool
        {
            Name = tool.FunctionName,
            Description = tool.Description,
            // Type is auto-set by the SDK — setting it here is an error.
            InputSchema = new()
            {
                Properties = properties,
                Required = tool.RequiredParameters.ToList()
            }
        };
    }

    /// <summary>
    /// Normalises the stored chat into what Anthropic accepts: a leading user turn with
    /// strictly alternating roles. Our chats can break both rules — a regenerate or a failed
    /// generation can leave two assistant messages in a row — so turns are merged rather
    /// than sent as-is and rejected.
    /// </summary>
    internal List<MessageParam> BuildMessages(AiRequest request)
    {
        var turns = new List<(Role Role, List<ContentBlockParam> Blocks)>();

        foreach (var message in request.Messages)
        {
            // Anthropic has no mid-conversation system role, so such a message is folded
            // into the user turn rather than dropped.
            var role = message.Role == AiChatRole.Assistant ? Role.Assistant : Role.User;
            var content = BuildContent(message, request.Parameters.AllowImages);

            if (content.Count == 0)
            {
                continue;
            }

            if (turns.Count > 0 && turns[^1].Role == role)
            {
                turns[^1].Blocks.AddRange(content);
                continue;
            }

            turns.Add((role, content));
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
        private readonly List<MessageParam> _messages;
        private readonly ILogger _logger;

        public Conversation(AiRequest request, List<MessageParam> messages, ILogger logger)
        {
            _request = request;
            _messages = messages;
            _logger = logger;
        }

        public async IAsyncEnumerable<AiStreamEvent> StreamTurnAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var parameters = BuildParams(_request, _messages, _request.Parameters.MaxOutputTokens, includeTools: true);

            using var client = CreateClient(_request.Endpoint);

            var assistantBlocks = new List<ContentBlockParam>();
            var text = new StringBuilder();

            // tool_use arrives as a start event with id/name, then its input streams in as
            // partial JSON fragments keyed by content-block index.
            var pendingToolCalls = new Dictionary<long, PendingToolCall>();

            await foreach (var streamEvent in client.Messages.CreateStreaming(parameters, cancellationToken))
            {
                if (streamEvent.TryPickContentBlockStart(out var start) && start != null)
                {
                    if (start.ContentBlock.TryPickToolUse(out var toolUse) && toolUse != null)
                    {
                        pendingToolCalls[start.Index] = new PendingToolCall(toolUse.ID, toolUse.Name);
                    }

                    continue;
                }

                if (streamEvent.TryPickContentBlockDelta(out var delta) && delta != null)
                {
                    if (delta.Delta.TryPickText(out var textDelta) && textDelta != null)
                    {
                        text.Append(textDelta.Text);
                        yield return new AiStreamEvent.Text(textDelta.Text);
                    }
                    else if (delta.Delta.TryPickInputJson(out var jsonDelta) && jsonDelta != null
                             && pendingToolCalls.TryGetValue(delta.Index, out var pending))
                    {
                        pending.Arguments.Append(jsonDelta.PartialJson);
                    }
                }
            }

            if (text.Length > 0)
            {
                assistantBlocks.Add(new TextBlockParam { Text = text.ToString() });
            }

            if (pendingToolCalls.Count == 0)
            {
                if (assistantBlocks.Count > 0)
                {
                    _messages.Add(new MessageParam { Role = Role.Assistant, Content = assistantBlocks });
                }

                yield break;
            }

            foreach (var (_, pending) in pendingToolCalls.OrderBy(pair => pair.Key))
            {
                var arguments = pending.Arguments.Length > 0 ? pending.Arguments.ToString() : "{}";

                assistantBlocks.Add(new ToolUseBlockParam
                {
                    ID = pending.Id,
                    Name = pending.Name,
                    Input = ParseArguments(arguments, pending.Name)
                });

                yield return new AiStreamEvent.ToolCall(pending.Id, pending.Name, arguments);
            }

            // The assistant turn carrying the calls must be in history before the results,
            // or the follow-up request is rejected for unmatched tool_use ids.
            _messages.Add(new MessageParam { Role = Role.Assistant, Content = assistantBlocks });
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

        private Dictionary<string, JsonElement> ParseArguments(string json, string toolName)
        {
            try
            {
                return JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json)
                       ?? new Dictionary<string, JsonElement>();
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Could not parse streamed arguments for tool {ToolName}", toolName);
                return new Dictionary<string, JsonElement>();
            }
        }

        private sealed record PendingToolCall(string Id, string Name)
        {
            public StringBuilder Arguments { get; } = new();
        }
    }
}
