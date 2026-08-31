using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Azure;
using Azure.AI.OpenAI;
using Microsoft.Extensions.Logging;
using OpenAI.Chat;

namespace ChatUitReact.Server.Services.AiProviders;

using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

/// <summary>
/// Azure OpenAI. Translates an <see cref="AiRequest"/> into the OpenAI SDK's shapes and
/// back; it does not decide what the model supports and does not run the tool loop.
/// </summary>
public sealed class AzureOpenAiProvider : IAiProvider
{
    /// <summary>A chat name is a few words; this only guards against a chatty model.</summary>
    private const int NamingTokenBudget = 50;

    /// <summary>Room for a reasoning model to think before it writes the name.</summary>
    private const int NamingReasoningTokenBudget = 2_000;

    private readonly ILogger<AzureOpenAiProvider> _logger;

    public AzureOpenAiProvider(ILogger<AzureOpenAiProvider> logger)
    {
        _logger = logger;
    }

    public EndpointType EndpointType => EndpointType.AzureOpenAI;

    public IAiConversation StartConversation(AiRequest request)
    {
        return new Conversation(
            () => GetChatClient(request),
            BuildMessages(request),
            BuildCompletionOptions(request),
            _logger);
    }

    public async Task<string> CompleteTextAsync(AiRequest request, CancellationToken cancellationToken = default)
    {
        var options = new ChatCompletionOptions
        {
            MaxOutputTokenCount = request.Parameters.ReasoningActive
                ? Math.Min(NamingReasoningTokenBudget, request.Parameters.MaxOutputTokens)
                : NamingTokenBudget
        };

        if (request.Parameters.Temperature.HasValue)
        {
            options.Temperature = request.Parameters.Temperature.Value;
        }

        var client = GetChatClient(request);
        var completion = await client.CompleteChatAsync(BuildMessages(request), options, cancellationToken);

        return completion.Value.Content.Count > 0
            ? completion.Value.Content[0].Text.Trim()
            : string.Empty;
    }

    /// <summary>
    /// A new client for each call, built from the endpoint row as it is right now. Endpoints
    /// are edited in the admin panel while the server runs, so a client kept between calls
    /// would go on using the URL and key it was created with until the next restart.
    /// </summary>
    private static ChatClient GetChatClient(AiRequest request)
    {
        return new AzureOpenAIClient(
                new Uri(request.Endpoint.Url),
                new AzureKeyCredential(request.Endpoint.ApiKey))
            .GetChatClient(request.Model.ModelId);
    }

    private ChatCompletionOptions BuildCompletionOptions(AiRequest request)
    {
        var parameters = request.Parameters;
        var options = new ChatCompletionOptions
        {
            MaxOutputTokenCount = parameters.MaxOutputTokens
        };

        if (parameters.Temperature.HasValue)
        {
            options.Temperature = parameters.Temperature.Value;
        }

        if (parameters.ReasoningActive)
        {
#pragma warning disable OPENAI001
            options.ReasoningEffortLevel = parameters.Effort switch
            {
                ReasoningEffort.Low => ChatReasoningEffortLevel.Low,
                ReasoningEffort.Medium => ChatReasoningEffortLevel.Medium,
                // The SDK exposes no xhigh/max level, so both map to the strongest it has.
                _ => ChatReasoningEffortLevel.High
            };
#pragma warning restore OPENAI001
        }

        foreach (var tool in request.Tools)
        {
            options.Tools.Add(ToOpenAiTool(tool));
        }

        return options;
    }

    private static OpenAI.Chat.ChatTool ToOpenAiTool(Models.ChatTool tool) =>
        OpenAI.Chat.ChatTool.CreateFunctionTool(
            functionName: tool.FunctionName,
            functionDescription: tool.Description,
            functionParameters: BinaryData.FromString(ToolSchemaJson.Build(tool)));

    private List<OpenAI.Chat.ChatMessage> BuildMessages(AiRequest request)
    {
        var messages = new List<OpenAI.Chat.ChatMessage>();

        // OpenAI takes the system prompt as a leading message; Anthropic takes it as a
        // top-level parameter, which is why AiRequest keeps it separate from Messages.
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
                    messages.Add(new AssistantChatMessage(message.Content));
                    break;
                case AiChatRole.System:
                    messages.Add(new SystemChatMessage(message.Content));
                    break;
            }
        }

        return messages;
    }

    private UserChatMessage BuildUserMessage(Models.ChatMessage message, bool allowImages)
    {
        if (message.Files == null || message.Files.Count == 0)
        {
            return new UserChatMessage(message.Content);
        }

        var parts = new List<ChatMessageContentPart>();

        if (!string.IsNullOrEmpty(message.Content))
        {
            parts.Add(ChatMessageContentPart.CreateTextPart(message.Content));
        }

        foreach (var file in message.Files)
        {
            AppendFile(file, parts, allowImages);
        }

        return new UserChatMessage(parts);
    }

    private void AppendFile(ChatFile file, List<ChatMessageContentPart> parts, bool allowImages)
    {
        try
        {
            parts.Add(ChatMessageContentPart.CreateTextPart($"\n--- ATTACHED FILE: {file.SourceFilename} ---\n"));

            for (var i = 0; i < file.Chunks.Count; i++)
            {
                var chunk = file.Chunks[i];
                parts.Add(ChatMessageContentPart.CreateTextPart($"[File Part {i + 1} of {file.Chunks.Count}]\n"));

                if (chunk.Type.Equals("text", StringComparison.OrdinalIgnoreCase))
                {
                    parts.Add(ChatMessageContentPart.CreateTextPart((chunk.Text ?? string.Empty) + "\n"));
                }
                else if (chunk.Type.Equals("image", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(chunk.Base64))
                {
                    if (!allowImages)
                    {
                        // Better a visible note than an image the model will reject.
                        parts.Add(ChatMessageContentPart.CreateTextPart("[Image omitted: this model cannot read images]\n"));
                        continue;
                    }

                    var bytes = Convert.FromBase64String(chunk.Base64);
                    parts.Add(ChatMessageContentPart.CreateImagePart(BinaryData.FromBytes(bytes), ResolveMediaType(chunk.Format)));
                    parts.Add(ChatMessageContentPart.CreateTextPart("\n"));
                }
            }

            parts.Add(ChatMessageContentPart.CreateTextPart($"--- END OF FILE: {file.SourceFilename} ---\n\n"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing file {FileName}", file.SourceFilename);
            parts.Add(ChatMessageContentPart.CreateTextPart($"\n--- ERROR: Could not process file {file.SourceFilename} ---\n"));
        }
    }

    /// <summary>
    /// Chunks carry a format (e.g. "png"); this used to be hardcoded to jpeg, which Azure
    /// tolerates but stricter providers do not.
    /// </summary>
    private static string ResolveMediaType(string? format)
    {
        var normalized = (format ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized.StartsWith("image/"))
        {
            return normalized;
        }

        return normalized switch
        {
            "png" => "image/png",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "jpg" or "jpeg" => "image/jpeg",
            _ => "image/jpeg"
        };
    }

    /// <summary>
    /// Holds the conversation in the OpenAI SDK's own message shape, so tool results are
    /// appended the way that SDK expects (an assistant message carrying the calls, then one
    /// tool message per result).
    /// </summary>
    private sealed class Conversation : IAiConversation
    {
        /// <summary>Builds a client per turn, so an endpoint edited mid-conversation is picked up.</summary>
        private readonly Func<ChatClient> _createClient;
        private readonly List<OpenAI.Chat.ChatMessage> _messages;
        private readonly ChatCompletionOptions _options;
        private readonly ILogger _logger;

        public Conversation(
            Func<ChatClient> createClient,
            List<OpenAI.Chat.ChatMessage> messages,
            ChatCompletionOptions options,
            ILogger logger)
        {
            _createClient = createClient;
            _messages = messages;
            _options = options;
            _logger = logger;
        }

        public async IAsyncEnumerable<AiStreamEvent> StreamTurnAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var stream = _createClient().CompleteChatStreamingAsync(_messages, _options, cancellationToken);

            var text = new StringBuilder();
            var toolCallsBuilder = new StreamingChatToolCallsBuilder();

            await foreach (var update in stream.WithCancellation(cancellationToken))
            {
                if (update.ContentUpdate?.Count > 0)
                {
                    var delta = update.ContentUpdate[0].Text;
                    if (!string.IsNullOrEmpty(delta))
                    {
                        text.Append(delta);
                        yield return new AiStreamEvent.Text(delta);
                    }
                }

                foreach (var toolCallUpdate in update.ToolCallUpdates)
                {
                    toolCallsBuilder.Append(toolCallUpdate);
                }
            }

            var toolCalls = toolCallsBuilder.Build();
            if (toolCalls.Count == 0)
            {
                yield break;
            }

            // The assistant turn carrying the calls has to be in history before the results,
            // or the follow-up request is rejected as unmatched tool results.
            var assistantMessage = new AssistantChatMessage(text.ToString());
            foreach (var toolCall in toolCalls)
            {
                assistantMessage.ToolCalls.Add(toolCall);
                yield return new AiStreamEvent.ToolCall(
                    toolCall.Id,
                    toolCall.FunctionName,
                    toolCall.FunctionArguments.ToString());
            }

            _messages.Add(assistantMessage);
        }

        public void AppendToolResults(IReadOnlyList<AiToolResult> results)
        {
            foreach (var result in results)
            {
                _messages.Add(new ToolChatMessage(result.ToolCallId, result.Content));
            }
        }
    }
}
