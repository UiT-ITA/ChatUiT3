using System;
using System.ClientModel;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using OpenAI;
using OpenAI.Responses;

// The OpenAI SDK ships its Responses surface as [Experimental].
#pragma warning disable OPENAI001

namespace ChatUitReact.Server.Services.AiProviders;

using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

/// <summary>
/// Azure OpenAI, via the Responses API. Translates an <see cref="AiRequest"/> into the
/// OpenAI SDK's shapes and back; it does not decide what the model supports and does not
/// run the tool loop.
/// </summary>
public sealed class AzureOpenAiProvider : IAiProvider
{
    /// <summary>Hard cap on a chat name, enforced by the naming response schema.</summary>
    private const int NamingMaxNameLength = 30;

    private readonly ILogger<AzureOpenAiProvider> _logger;

    public AzureOpenAiProvider(ILogger<AzureOpenAiProvider> logger)
    {
        _logger = logger;
    }

    public EndpointType EndpointType => EndpointType.AzureOpenAI;

    public IAiConversation StartConversation(AiRequest request)
    {
        return new Conversation(request, BuildInputItems(request), _logger);
    }

    public async Task<string> GenerateChatNameAsync(AiRequest request, CancellationToken cancellationToken = default)
    {
        var options = BuildOptions(request, BuildInputItems(request));

        // The response is constrained to {"name": "..."} with the name capped at
        // NamingMaxNameLength characters, enforced by the service at generation time.
        options.TextOptions = new ResponseTextOptions
        {
            TextFormat = ResponseTextFormat.CreateJsonSchemaFormat(
                jsonSchemaFormatName: "chat_name",
                jsonSchema: BinaryData.FromString($$"""
                    {
                        "type": "object",
                        "properties": {
                            "name": { "type": "string", "maxLength": {{NamingMaxNameLength}} }
                        },
                        "required": ["name"],
                        "additionalProperties": false
                    }
                    """),
                jsonSchemaIsStrict: true)
        };

        var response = await GetClient(request).CreateResponseAsync(options, cancellationToken);
        var text = response.Value.GetOutputText();
        if (string.IsNullOrWhiteSpace(text))
        {
            return string.Empty;
        }

        try
        {
            using var json = JsonDocument.Parse(text);
            return json.RootElement.GetProperty("name").GetString()?.Trim() ?? string.Empty;
        }
        catch (JsonException)
        {
            // Non-JSON response: the text itself is the name.
            return text.Trim();
        }
    }

    /// <summary>
    /// A new client for each call, built from the endpoint row as it is right now. Endpoints
    /// are edited in the admin panel while the server runs, so a client kept between calls
    /// would go on using the URL and key it was created with until the next restart.
    /// Targets the resource's <c>/openai/v1</c> surface, which is where Azure serves the
    /// Responses API; the endpoint row holds the resource base URL.
    /// </summary>
    private static ResponsesClient GetClient(AiRequest request)
    {
        var baseUrl = request.Endpoint.Url.TrimEnd('/');

        return new ResponsesClient(
            credential: new ApiKeyCredential(request.Endpoint.ApiKey),
            options: new OpenAIClientOptions { Endpoint = new Uri($"{baseUrl}/openai/v1") });
    }

    /// <summary>
    /// One request's options: model, input items, temperature, reasoning effort, and tools.
    /// The conversation is kept client-side, so nothing is stored on the service and no
    /// output limit is sent.
    /// </summary>
    private static CreateResponseOptions BuildOptions(AiRequest request, List<ResponseItem> inputItems)
    {
        var parameters = request.Parameters;
        var options = new CreateResponseOptions(request.Model.ModelId, inputItems)
        {
            StoredOutputEnabled = false
        };

        if (!string.IsNullOrEmpty(request.SystemPrompt))
        {
            options.Instructions = request.SystemPrompt;
        }

        if (parameters.Temperature.HasValue)
        {
            options.Temperature = parameters.Temperature.Value;
        }

        // The effort level is set for models that reason — including an explicit "none"
        // when reasoning is off, since an omitted level falls back to the service default.
        // Models without reasoning get no reasoning options at all.
        if (request.Model.Capabilities.SupportsReasoning)
        {
            options.ReasoningOptions = new ResponseReasoningOptions
            {
                ReasoningEffortLevel = parameters.Effort switch
                {
                    ReasoningEffort.None => ResponseReasoningEffortLevel.None,
                    ReasoningEffort.Low => ResponseReasoningEffortLevel.Low,
                    ReasoningEffort.Medium => ResponseReasoningEffortLevel.Medium,
                    ReasoningEffort.High => ResponseReasoningEffortLevel.High,
                    // The SDK names no levels above high; custom values pass through as-is.
                    ReasoningEffort.XHigh => new ResponseReasoningEffortLevel("xhigh"),
                    _ => new ResponseReasoningEffortLevel("max")
                }
            };
        }

        foreach (var tool in request.Tools)
        {
            options.Tools.Add(ResponseTool.CreateFunctionTool(
                functionName: tool.FunctionName,
                functionParameters: BinaryData.FromString(ToolSchemaJson.Build(tool)),
                strictModeEnabled: false,
                functionDescription: tool.Description));
        }

        return options;
    }

    private List<ResponseItem> BuildInputItems(AiRequest request)
    {
        var items = new List<ResponseItem>();

        foreach (var message in request.Messages)
        {
            switch (message.Role)
            {
                case AiChatRole.User:
                    items.Add(BuildUserItem(message, request.Parameters.AllowImages));
                    break;
                case AiChatRole.Assistant:
                    items.Add(ResponseItem.CreateAssistantMessageItem(message.Content));
                    break;
                case AiChatRole.System:
                    items.Add(ResponseItem.CreateSystemMessageItem(message.Content));
                    break;
            }
        }

        return items;
    }

    private ResponseItem BuildUserItem(Models.ChatMessage message, bool allowImages)
    {
        if (message.Files == null || message.Files.Count == 0)
        {
            return ResponseItem.CreateUserMessageItem(message.Content);
        }

        var parts = new List<ResponseContentPart>();

        if (!string.IsNullOrEmpty(message.Content))
        {
            parts.Add(ResponseContentPart.CreateInputTextPart(message.Content));
        }

        foreach (var file in message.Files)
        {
            AppendFile(file, parts, allowImages);
        }

        return ResponseItem.CreateUserMessageItem(parts);
    }

    private void AppendFile(ChatFile file, List<ResponseContentPart> parts, bool allowImages)
    {
        try
        {
            parts.Add(ResponseContentPart.CreateInputTextPart($"\n--- ATTACHED FILE: {file.SourceFilename} ---\n"));

            for (var i = 0; i < file.Chunks.Count; i++)
            {
                var chunk = file.Chunks[i];
                parts.Add(ResponseContentPart.CreateInputTextPart($"[File Part {i + 1} of {file.Chunks.Count}]\n"));

                if (chunk.Type.Equals("text", StringComparison.OrdinalIgnoreCase))
                {
                    parts.Add(ResponseContentPart.CreateInputTextPart((chunk.Text ?? string.Empty) + "\n"));
                }
                else if (chunk.Type.Equals("image", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(chunk.Base64))
                {
                    if (!allowImages)
                    {
                        // Better a visible note than an image the model will reject.
                        parts.Add(ResponseContentPart.CreateInputTextPart("[Image omitted: this model cannot read images]\n"));
                        continue;
                    }

                    var imageUri = new Uri($"data:{ResolveMediaType(chunk.Format)};base64,{chunk.Base64}");
                    parts.Add(ResponseContentPart.CreateInputImagePart(imageUri));
                    parts.Add(ResponseContentPart.CreateInputTextPart("\n"));
                }
            }

            parts.Add(ResponseContentPart.CreateInputTextPart($"--- END OF FILE: {file.SourceFilename} ---\n\n"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing file {FileName}", file.SourceFilename);
            parts.Add(ResponseContentPart.CreateInputTextPart($"\n--- ERROR: Could not process file {file.SourceFilename} ---\n"));
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
    /// Holds the conversation as a client-side list of response items. Every output item a
    /// turn produces — messages, function calls, and reasoning items — is appended to the
    /// list, so reasoning state carries across tool rounds without server-side storage.
    /// </summary>
    private sealed class Conversation : IAiConversation
    {
        private readonly AiRequest _request;
        private readonly List<ResponseItem> _items;
        private readonly ILogger _logger;

        public Conversation(AiRequest request, List<ResponseItem> items, ILogger logger)
        {
            _request = request;
            _items = items;
            _logger = logger;
        }

        public async IAsyncEnumerable<AiStreamEvent> StreamTurnAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            // Options are rebuilt each turn from the endpoint row as it is right now.
            var options = BuildOptions(_request, _items);
            var stream = GetClient(_request).CreateResponseStreamingAsync(options, cancellationToken);

            var toolCalls = new List<FunctionCallResponseItem>();

            await foreach (var update in stream.WithCancellation(cancellationToken))
            {
                if (update is StreamingResponseOutputTextDeltaUpdate delta)
                {
                    if (!string.IsNullOrEmpty(delta.Delta))
                    {
                        yield return new AiStreamEvent.Text(delta.Delta);
                    }
                }
                else if (update is StreamingResponseOutputItemDoneUpdate done)
                {
                    _items.Add(done.Item);

                    if (done.Item is FunctionCallResponseItem toolCall)
                    {
                        toolCalls.Add(toolCall);
                    }
                }
            }

            foreach (var toolCall in toolCalls)
            {
                yield return new AiStreamEvent.ToolCall(
                    toolCall.CallId,
                    toolCall.FunctionName,
                    toolCall.FunctionArguments.ToString());
            }
        }

        public void AppendToolResults(IReadOnlyList<AiToolResult> results)
        {
            foreach (var result in results)
            {
                _items.Add(ResponseItem.CreateFunctionCallOutputItem(result.ToolCallId, result.Content));
            }
        }
    }
}
