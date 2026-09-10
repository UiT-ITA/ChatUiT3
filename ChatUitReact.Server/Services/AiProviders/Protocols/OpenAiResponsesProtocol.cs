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

namespace ChatUitReact.Server.Services.AiProviders.Protocols;

using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.TokenCounting;
using ChatUitReact.Server.Services.Tools;

/// <summary>
/// OpenAI Responses API. Translates an <see cref="AiRequest"/> into the OpenAI SDK's shapes
/// and back; it does not decide what the model supports and does not run the tool loop.
/// </summary>
public sealed class OpenAiResponsesProtocol : IApiProtocol
{
    /// <summary>Hard cap on a chat name, enforced by the naming response schema.</summary>
    private const int NamingMaxNameLength = 30;

    private readonly ILogger<OpenAiResponsesProtocol> _logger;

    public OpenAiResponsesProtocol(ILogger<OpenAiResponsesProtocol> logger)
    {
        _logger = logger;
    }

    public ApiProtocol Protocol => ApiProtocol.OpenAiResponses;

    public IAiConversation StartConversation(AiRequest request, ProtocolTarget target)
    {
        return new Conversation(request, target, BuildInputItems(request), _logger);
    }

    public async Task<string> GenerateChatNameAsync(AiRequest request, ProtocolTarget target, CancellationToken cancellationToken = default)
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

        var response = await GetClient(target).CreateResponseAsync(options, cancellationToken);
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
    /// A new client for each call, built from the target as it is right now. Endpoints are
    /// edited in the admin panel while the server runs, so a client kept between calls would
    /// go on using the URL and key it was created with until the next restart. The host
    /// provider has already composed the base URL this protocol is served on.
    /// </summary>
    private static ResponsesClient GetClient(ProtocolTarget target)
    {
        if (string.IsNullOrWhiteSpace(target.BaseUrl))
        {
            throw new InvalidOperationException("OpenAI Responses needs a base URL; the host provider did not supply one.");
        }

        return new ResponsesClient(
            credential: new ApiKeyCredential(target.ApiKey),
            options: new OpenAIClientOptions { Endpoint = new Uri(target.BaseUrl) });
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
                },
                // Reasoning summaries are only returned when asked for. The raw reasoning is
                // never available; this is what the activity panel shows as thinking.
                ReasoningSummaryVerbosity = parameters.ReasoningActive
                    ? ResponseReasoningSummaryVerbosity.Detailed
                    : (ResponseReasoningSummaryVerbosity?)null
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

    private static ResponseItem BuildUserItem(Models.ChatMessage message, bool allowImages)
    {
        if (message.Files == null || message.Files.Count == 0)
        {
            return ResponseItem.CreateUserMessageItem(message.Content);
        }

        var parts = new List<ResponseContentPart>();
        foreach (var part in MessageParts.Build(message, allowImages))
        {
            switch (part)
            {
                case TextPart text:
                    parts.Add(ResponseContentPart.CreateInputTextPart(text.Text));
                    break;
                case ImagePart image:
                    parts.Add(ResponseContentPart.CreateInputImagePart(new Uri($"data:{image.MediaType};base64,{image.Base64}")));
                    break;
            }
        }

        return ResponseItem.CreateUserMessageItem(parts);
    }

    /// <summary>
    /// Holds the conversation as a client-side list of response items. Every output item a
    /// turn produces — messages, function calls, and reasoning items — is appended to the
    /// list, so reasoning state carries across tool rounds without server-side storage.
    /// </summary>
    private sealed class Conversation : IAiConversation
    {
        private readonly AiRequest _request;
        private readonly ProtocolTarget _target;
        private readonly List<ResponseItem> _items;
        private readonly ILogger _logger;

        public Conversation(AiRequest request, ProtocolTarget target, List<ResponseItem> items, ILogger logger)
        {
            _request = request;
            _target = target;
            _items = items;
            _logger = logger;
        }

        public async IAsyncEnumerable<AiStreamEvent> StreamTurnAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            // Options are rebuilt each turn from the endpoint row as it is right now.
            var options = BuildOptions(_request, _items);

            // The SDK refuses CreateResponseStreamingAsync unless the options say so.
            options.StreamingEnabled = true;

            var stream = GetClient(_target).CreateResponseStreamingAsync(options, cancellationToken);

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
                else if (update is StreamingResponseReasoningSummaryTextDeltaUpdate summaryDelta)
                {
                    if (!string.IsNullOrEmpty(summaryDelta.Delta))
                    {
                        yield return new AiStreamEvent.Thinking(summaryDelta.Delta);
                    }
                }
                else if (update is StreamingResponseReasoningSummaryPartDoneUpdate)
                {
                    // Each summary part is a paragraph of its own.
                    yield return new AiStreamEvent.ThinkingBreak();
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
