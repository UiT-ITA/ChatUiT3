using System;
using System.ClientModel;
using System.ClientModel.Primitives;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using OpenAI;
using OpenAI.Responses;

// The OpenAI SDK ships its Responses surface as [Experimental].
#pragma warning disable OPENAI001
// JsonPatch, used to send a tool output as content parts, is [Experimental].
#pragma warning disable SCME0001

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
            options: new ResponsesClientOptions { Endpoint = new Uri(target.BaseUrl) });
    }

    /// <summary>
    /// One request's options: model, input items, temperature, reasoning effort, and tools.
    /// The conversation is kept client-side, so nothing is stored on the service and no
    /// output limit is sent.
    /// </summary>
    private static CreateResponseOptions BuildOptions(AiRequest request, List<ResponseItem> inputItems, bool allowToolCalls = true)
    {
        var parameters = request.Parameters;
        var options = new CreateResponseOptions(request.Model.ModelId, inputItems)
        {
            StoredOutputEnabled = false
        };

        // Sent as `instructions`, the prompt arrives as a developer message after the tool
        // definitions, leaving the wrapper's own "# Instructions" header empty. A developer
        // input item at the head of the input renders exactly the same way (tested against
        // GPT-5 in September 2026), so the documented field is used.
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
                    ? parameters.SummaryLength == ReasoningSummaryLength.Concise
                        ? ResponseReasoningSummaryVerbosity.Concise
                        : ResponseReasoningSummaryVerbosity.Detailed
                    : (ResponseReasoningSummaryVerbosity?)null
            };
        }

        // Nothing is stored on the service, so a reasoning item replayed on a later round or
        // request is only accepted with its encrypted content.
        if (parameters.ReasoningActive)
        {
            options.IncludedProperties.Add(IncludedResponseProperty.ReasoningEncryptedContent);
        }

        foreach (var tool in request.Tools)
        {
            options.Tools.Add(ResponseTool.CreateFunctionTool(
                functionName: tool.Id,
                functionParameters: BinaryData.FromString(tool.ParametersSchema.ToJsonString()),
                strictModeEnabled: false,
                functionDescription: tool.Description));
        }

        if (!allowToolCalls && request.Tools.Count > 0)
        {
            options.ToolChoice = ResponseToolChoice.CreateNoneChoice();
        }

        return options;
    }

    private List<ResponseItem> BuildInputItems(AiRequest request)
    {
        var items = new List<ResponseItem>();

        foreach (var segment in AiInputSegment.Split(request.Messages, Protocol, request.Model.Id))
        {
            switch (segment)
            {
                case AiInputSegment.Message message:
                    AddMessage(items, message.Value, request.Parameters.AllowImages);
                    break;
                case AiInputSegment.AssistantTurn turn:
                    // Reasoning items lead the turn: the service expects each one before the
                    // message or function call it produced.
                    foreach (var state in turn.Reasoning)
                    {
                        AddReasoning(items, state);
                    }

                    foreach (var message in turn.Messages)
                    {
                        AddMessage(items, message, request.Parameters.AllowImages);
                    }

                    foreach (var call in turn.ToolCalls)
                    {
                        items.Add(ResponseItem.CreateFunctionCallItem(call.Id, call.Name, BinaryData.FromString(call.ArgumentsJson)));
                    }
                    break;
                case AiInputSegment.ToolResults results:
                    foreach (var result in results.Results)
                    {
                        items.Add(BuildToolOutputItem(result, request.Parameters.AllowImages));
                        AddLoadedTools(items, request, result.LoadedToolIds);
                    }
                    break;
            }
        }

        return items;
    }

    /// <summary>
    /// A tool result as a function_call_output. With images, the output is a list of
    /// input_text and input_image parts, which the service accepts but the SDK models only as a
    /// string, so the list is set through the item's patch. A model that cannot read images gets
    /// the note instead.
    /// </summary>
    private static ResponseItem BuildToolOutputItem(AiInputItem.ToolResult result, bool allowImages)
    {
        if (result.Images is not { Count: > 0 } images)
        {
            return ResponseItem.CreateFunctionCallOutputItem(result.ToolCallId, result.Content);
        }

        if (!allowImages)
        {
            return ResponseItem.CreateFunctionCallOutputItem(result.ToolCallId, $"{result.Content}\n{MessageParts.ImageOmittedText}");
        }

        var parts = new JsonArray { new JsonObject { ["type"] = "input_text", ["text"] = result.Content } };
        foreach (var image in images)
        {
            parts.Add(new JsonObject { ["type"] = "input_image", ["image_url"] = $"data:{image.MediaType};base64,{image.Base64}" });
        }

        var item = ResponseItem.CreateFunctionCallOutputItem(result.ToolCallId, result.Content);
        item.Patch.Set("$.output"u8, BinaryData.FromString(parts.ToJsonString()));
        return item;
    }

    /// <summary>
    /// After a toolbox load's output: an additional_tools developer item with the definitions of
    /// the tools it loaded. On replay the item is rebuilt at the same place. The SDK has no type
    /// for the item, so it is read from its JSON.
    /// </summary>
    private static void AddLoadedTools(List<ResponseItem> items, AiRequest request, IReadOnlyList<string>? loadedToolIds)
    {
        if (loadedToolIds is not { Count: > 0 })
        {
            return;
        }

        var tools = new JsonArray();
        foreach (var id in loadedToolIds)
        {
            if (request.LoadableTools.FirstOrDefault(t => t.Id == id) is not { } tool)
            {
                continue;
            }

            tools.Add(new JsonObject
            {
                ["type"] = "function",
                ["name"] = tool.Id,
                ["description"] = tool.Description,
                ["parameters"] = JsonNode.Parse(tool.ParametersSchema.ToJsonString()),
                ["strict"] = false
            });
        }

        if (tools.Count == 0)
        {
            return;
        }

        var item = new JsonObject { ["type"] = "additional_tools", ["role"] = "developer", ["tools"] = tools };
        items.Add(ModelReaderWriter.Read<ResponseItem>(BinaryData.FromString(item.ToJsonString()), ModelReaderWriterOptions.Json)!);
    }

    private static void AddMessage(List<ResponseItem> items, Models.ChatMessage message, bool allowImages)
    {
        switch (message.Role)
        {
            case AiChatRole.User:
                items.Add(BuildUserItem(message, allowImages));
                break;
            case AiChatRole.Assistant:
                items.Add(ResponseItem.CreateAssistantMessageItem(message.Content));
                break;
            case AiChatRole.System:
                items.Add(ResponseItem.CreateDeveloperMessageItem(message.Content));
                break;
        }
    }

    /// <summary>The payload is the turn's reasoning items exactly as the service returned them.</summary>
    private void AddReasoning(List<ResponseItem> items, AiInputItem.ReasoningState state)
    {
        if (state.Payload.ValueKind != JsonValueKind.Array)
        {
            return;
        }

        foreach (var element in state.Payload.EnumerateArray())
        {
            try
            {
                items.Add(ModelReaderWriter.Read<ResponseItem>(BinaryData.FromString(element.GetRawText()), ModelReaderWriterOptions.Json)!);
            }
            catch (Exception ex) when (ex is FormatException or JsonException or InvalidOperationException)
            {
                _logger.LogWarning(ex, "Dropping a reasoning item that could not be read back");
            }
        }
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
            bool allowToolCalls = true,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            // Options are rebuilt each turn from the endpoint row as it is right now.
            var options = BuildOptions(_request, _items, allowToolCalls);

            // The SDK refuses CreateResponseStreamingAsync unless the options say so.
            options.StreamingEnabled = true;

            var stream = GetClient(_target).CreateResponseStreamingAsync(options, cancellationToken);

            var toolCalls = new List<FunctionCallResponseItem>();
            var reasoning = new List<ReasoningResponseItem>();

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
                else if (update is StreamingResponseIncompleteUpdate incomplete)
                {
                    // Without this a turn cut short (output limit, content filter) ends silently,
                    // with whatever it had produced, or with nothing at all.
                    var reason = incomplete.Response?.IncompleteStatusDetails?.Reason?.ToString() ?? "unknown";
                    _logger.LogWarning("OpenAI Responses turn on {Model} ended incomplete: reason {Reason}", _request.Model.ModelId, reason);
                    throw new AiTurnFailedException($"The model stopped before finishing its answer (incomplete: {reason}).");
                }
                else if (update is StreamingResponseFailedUpdate failed)
                {
                    var code = failed.Response?.Error?.Code.ToString() ?? "unknown";
                    _logger.LogWarning("OpenAI Responses turn on {Model} failed: code {Code}", _request.Model.ModelId, code);
                    throw new AiTurnFailedException($"The model service reported a failure ({code}): {failed.Response?.Error?.Message ?? "no message"}");
                }
                else if (update is StreamingResponseErrorUpdate error)
                {
                    _logger.LogWarning("OpenAI Responses turn on {Model} got a stream error: code {Code}", _request.Model.ModelId, error.Code ?? "unknown");
                    throw new AiTurnFailedException($"The model service sent an error ({error.Code ?? "unknown"}): {error.Message ?? "no message"}");
                }
                else if (update is StreamingResponseCompletedUpdate completed && completed.Response?.Usage is { } usage)
                {
                    _logger.LogInformation(
                        "OpenAI Responses turn on {Model}: {InputTokens} input tokens, {CacheReadTokens} read from cache",
                        _request.Model.ModelId, usage.InputTokenCount, usage.InputTokenDetails?.CachedTokenCount ?? 0);
                }
                else if (update is StreamingResponseOutputItemDoneUpdate done)
                {
                    _items.Add(done.Item);

                    if (done.Item is FunctionCallResponseItem toolCall)
                    {
                        toolCalls.Add(toolCall);
                    }
                    else if (done.Item is ReasoningResponseItem reasoningItem)
                    {
                        reasoning.Add(reasoningItem);
                    }
                }
            }

            if (reasoning.Count > 0)
            {
                using var payload = JsonDocument.Parse("[" + string.Join(",", reasoning.Select(item => ModelReaderWriter.Write(item, ModelReaderWriterOptions.Json).ToString())) + "]");
                yield return new AiStreamEvent.ReasoningState(payload.RootElement.Clone());
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
                AddLoadedTools(_items, _request, result.LoadedToolIds);
            }
        }
    }
}
