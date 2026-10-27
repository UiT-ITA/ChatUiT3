using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Agents;
using ChatUiT.Server.Services.AiProviders;
using ChatUiT.Server.Services.ApiCatalog;
using ChatUiT.Server.Services.TokenCounting;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.ResponsesApi;

/// <summary>An answered approval to continue before the model runs. <see cref="Slot"/> is where its result goes in the history.</summary>
public sealed record PendingResume(int Slot, ApprovalState State, ResumeInput Input);

/// <summary>A validated request, ready for <see cref="ResponsesRunner"/>.</summary>
public sealed class MappedRequest
{
    /// <summary>The history. A null entry is the result slot of a <see cref="PendingResume"/>.</summary>
    public required List<AiInputItem?> History { get; init; }

    public required IReadOnlyList<PendingResume> Resumes { get; init; }

    /// <summary>Model turns that called tools since the last user message, counted from the input.</summary>
    public required int RoundsSinceUserMessage { get; init; }

    public required IReadOnlyList<ITool> ClientTools { get; init; }

    /// <summary>An agent's functions; none for a raw model.</summary>
    public required IReadOnlyList<ITool> ServerTools { get; init; }

    /// <summary>An agent's round budget, counted with <see cref="RoundsSinceUserMessage"/>; null for a raw model.</summary>
    public required int? MaxRounds { get; init; }

    public required string SystemPrompt { get; init; }

    public required ResolvedChatParameters Parameters { get; init; }

    public bool Stream { get; init; }
}

/// <summary>
/// Validates a Responses request against the contract and turns its items into the neutral
/// history. Everything that can be refused is refused here, before a stream starts.
///
/// The history is rebuilt from the items alone, since nothing is stored:
/// <list type="bullet">
/// <item>Assistant-side items of one model turn (reasoning, text, calls) are kept together and
/// followed by the results of that turn's calls, in call order. A turn ends at a user or system
/// message, at the first result item, or when reasoning or text follows a call.</item>
/// <item>A server call is identified by its call id across items: an approval request, any later
/// approval request for the same call, and the <c>mcp_call</c> that finally carries its result.
/// The first item places the call; the last decides its result.</item>
/// <item>An answered approval whose result is not in the input becomes a <see cref="PendingResume"/>.
/// An unanswered one followed by a new user message is recorded as not performed.</item>
/// </list>
/// </summary>
public sealed class ResponsesRequestMapper
{
    private const string NotRespondedText = "The user did not respond; the action was not performed.";
    private const string NotCompletedText = "The call did not complete; the action was not performed.";
    private const string AdditionalInstructionsHeader = "# Additional instructions from the client";

    private static readonly HashSet<string> ItemTypes = new(StringComparer.Ordinal)
    {
        "message", "function_call", "function_call_output", "reasoning", "mcp_call", "mcp_approval_request", "mcp_approval_response"
    };

    private readonly ItemSealer _sealer;
    private readonly IToolRegistry _toolRegistry;

    public ResponsesRequestMapper(ItemSealer sealer, IToolRegistry toolRegistry)
    {
        _sealer = sealer;
        _toolRegistry = toolRegistry;
    }

    /// <param name="setup">The agent's run setup; null for a raw model.</param>
    /// <exception cref="ResponsesApiException">The request breaks the contract.</exception>
    public MappedRequest Map(CreateResponseRequest request, ApiTarget target, InternalAgentSetup? setup, ToolExecutionContext context)
    {
        RejectUnsupported(request.Unsupported, null);

        if (request.Store == true)
        {
            throw ResponsesApiException.BadRequest("store must be false or omitted: nothing is stored.", "store", "unsupported_value");
        }

        if (request.ToolChoice is { } toolChoice && toolChoice.ValueKind != JsonValueKind.Null
            && !(toolChoice.ValueKind == JsonValueKind.String && toolChoice.GetString() == "auto"))
        {
            throw ResponsesApiException.BadRequest("tool_choice must be \"auto\".", "tool_choice", "unsupported_value");
        }

        RejectUnsupported(request.Reasoning?.Unsupported, "reasoning");

        var serverTools = setup?.Functions ?? [];
        return new MappedRequest
        {
            History = BuildHistory(ParseInput(request.Input), target.PublicId, out var resumes, out var rounds),
            Resumes = resumes,
            RoundsSinceUserMessage = rounds,
            ClientTools = BuildClientTools(request, target, serverTools),
            ServerTools = serverTools,
            MaxRounds = setup?.MaxRounds,
            SystemPrompt = BuildSystemPrompt(request, setup),
            Parameters = ResolveParameters(request, target, setup, context.ReasoningSummaryLength),
            Stream = request.Stream == true
        };
    }

    private static void RejectUnsupported(Dictionary<string, JsonElement>? unsupported, string? parent)
    {
        var name = unsupported?.FirstOrDefault(p => p.Value.ValueKind != JsonValueKind.Null).Key;
        if (name != null)
        {
            var param = parent == null ? name : $"{parent}.{name}";
            throw ResponsesApiException.BadRequest($"Unsupported parameter: '{param}'.", param, "unsupported_parameter");
        }
    }

    private static string BuildSystemPrompt(CreateResponseRequest request, InternalAgentSetup? setup)
    {
        var instructions = request.Instructions?.Trim();
        if (setup == null)
        {
            return instructions ?? string.Empty;
        }

        return string.IsNullOrEmpty(instructions)
            ? setup.SystemPrompt
            : $"{setup.SystemPrompt}\n\n{AdditionalInstructionsHeader}\n\n{instructions}";
    }

    /// <summary>
    /// An agent runs with the parameters of its setup, as on every other path. A raw model takes
    /// temperature, output limit and effort from the request, reconciled with what the model
    /// accepts; an omitted temperature is not sent.
    /// </summary>
    private static ResolvedChatParameters ResolveParameters(CreateResponseRequest request, ApiTarget target, InternalAgentSetup? setup, ReasoningSummaryLength summaryLength)
    {
        if (setup != null)
        {
            if (request.Temperature != null || request.MaxOutputTokens != null || request.Reasoning?.Effort != null)
            {
                var param = request.Temperature != null ? "temperature" : request.MaxOutputTokens != null ? "max_output_tokens" : "reasoning.effort";
                throw ResponsesApiException.BadRequest($"{param} is only accepted for raw models; an agent uses its own settings.", param, "unsupported_parameter");
            }

            return setup.Parameters;
        }

        if (request.Temperature is { } temperature && (temperature < 0 || temperature > 2))
        {
            throw ResponsesApiException.BadRequest("temperature must be between 0 and 2.", "temperature", "invalid_value");
        }

        if (request.MaxOutputTokens is <= 0)
        {
            throw ResponsesApiException.BadRequest("max_output_tokens must be positive.", "max_output_tokens", "invalid_value");
        }

        var settings = new ChatSettings
        {
            Temperature = request.Temperature ?? 1f,
            ReasoningEffort = ParseEffort(request.Reasoning?.Effort)
        };

        var resolved = ChatParameterResolver.Resolve(target.Model.Capabilities, settings);
        return resolved with
        {
            Temperature = request.Temperature == null ? null : resolved.Temperature,
            MaxOutputTokens = request.MaxOutputTokens is { } max ? Math.Min(max, resolved.MaxOutputTokens) : resolved.MaxOutputTokens,
            SummaryLength = summaryLength
        };
    }

    private static ReasoningEffort ParseEffort(string? effort) => effort switch
    {
        null or "none" => ReasoningEffort.None,
        "minimal" or "low" => ReasoningEffort.Low,
        "medium" => ReasoningEffort.Medium,
        "high" => ReasoningEffort.High,
        "xhigh" => ReasoningEffort.XHigh,
        "max" => ReasoningEffort.Max,
        _ => throw ResponsesApiException.BadRequest($"Unsupported reasoning.effort '{effort}'.", "reasoning.effort", "unsupported_value")
    };

    private IReadOnlyList<ITool> BuildClientTools(CreateResponseRequest request, ApiTarget target, IReadOnlyList<ITool> serverTools)
    {
        var declared = request.Tools ?? [];
        if (declared.Count == 0)
        {
            return [];
        }

        if (!target.Model.Capabilities.SupportsFunctionCalling)
        {
            throw ResponsesApiException.BadRequest("This model cannot call functions.", "tools", "unsupported_parameter");
        }

        var declarations = new List<ClientToolDeclaration>(declared.Count);
        for (var i = 0; i < declared.Count; i++)
        {
            var tool = declared[i];
            var param = $"tools[{i}]";
            RejectUnsupported(tool.Unsupported, param);

            if (tool.Type != "function")
            {
                throw ResponsesApiException.BadRequest($"{param}: only tools of type \"function\" are supported.", $"{param}.type", "unsupported_value");
            }

            if (tool.Strict == true)
            {
                throw ResponsesApiException.BadRequest($"{param}: strict function tools are not supported.", $"{param}.strict", "unsupported_value");
            }

            declarations.Add(new ClientToolDeclaration(
                tool.Name ?? string.Empty,
                tool.Description,
                tool.Parameters is { ValueKind: not JsonValueKind.Null } parameters ? parameters : null));
        }

        try
        {
            return _toolRegistry.CreateResponsesClientTools(declarations, serverTools.Select(t => t.Id).ToList());
        }
        catch (ClientToolDeclarationException ex)
        {
            if (ex.Index is not { } index)
            {
                throw ResponsesApiException.BadRequest(ex.Message, "tools", "too_many_tools");
            }

            var param = $"tools[{index}]";
            throw ResponsesApiException.BadRequest($"{param}: {ex.Message}", $"{param}.{ex.Field}", "invalid_value");
        }
    }

    private static List<ResponseItem> ParseInput(JsonElement input)
    {
        if (input.ValueKind == JsonValueKind.String)
        {
            return [new MessageItem { Role = "user", Content = input }];
        }

        if (input.ValueKind != JsonValueKind.Array)
        {
            throw ResponsesApiException.BadRequest("input must be a string or an array of items.", "input", "invalid_value");
        }

        var items = new List<ResponseItem>();
        var index = 0;
        foreach (var element in input.EnumerateArray())
        {
            var param = $"input[{index++}]";
            if (element.ValueKind != JsonValueKind.Object)
            {
                throw ResponsesApiException.BadRequest($"{param} must be an object.", param, "invalid_value");
            }

            var type = element.TryGetProperty("type", out var typeElement) && typeElement.ValueKind == JsonValueKind.String
                ? typeElement.GetString()!
                : element.TryGetProperty("role", out _) ? "message" : null;
            if (type == null || !ItemTypes.Contains(type))
            {
                throw ResponsesApiException.BadRequest($"{param}: items of type '{type}' are not supported.", $"{param}.type", "unsupported_value");
            }

            try
            {
                var json = element;
                if (!element.TryGetProperty("type", out _))
                {
                    // The short message form has no type; the discriminator is added so it binds.
                    var node = JsonNode.Parse(element.GetRawText())!.AsObject();
                    node["type"] = "message";
                    json = JsonSerializer.SerializeToElement(node);
                }

                items.Add(json.Deserialize<ResponseItem>(ResponsesJson.Options)!);
            }
            catch (JsonException ex)
            {
                throw ResponsesApiException.BadRequest($"{param}: {ex.Message}", param, "invalid_value");
            }
        }

        return items;
    }

    private List<AiInputItem?> BuildHistory(List<ResponseItem> items, string catalogId, out List<PendingResume> resumes, out int rounds)
    {
        // First pass: index what later items refer to, and check references.
        var outputs = new Dictionary<string, int>(StringComparer.Ordinal);
        var functionCalls = new Dictionary<string, int>(StringComparer.Ordinal);
        var approvals = new Dictionary<int, ApprovalState>();
        var approvalIds = new HashSet<string>(StringComparer.Ordinal);
        var answers = new Dictionary<string, McpApprovalResponseItem>(StringComparer.Ordinal);
        var chains = new Dictionary<string, List<int>>(StringComparer.Ordinal);
        var lastUserMessage = -1;

        for (var i = 0; i < items.Count; i++)
        {
            var param = $"input[{i}]";
            switch (items[i])
            {
                case MessageItem message:
                    var messageRole = MapRole(message.Role, param);
                    // Parsed here so a malformed message or file is refused before anything runs.
                    ParseContent(message.Content, messageRole, param);
                    if (messageRole == AiChatRole.User)
                    {
                        lastUserMessage = i;
                    }
                    break;
                case FunctionCallItem call:
                    if (string.IsNullOrEmpty(call.CallId) || string.IsNullOrEmpty(call.Name))
                    {
                        throw ResponsesApiException.BadRequest($"{param}: function_call needs call_id and name.", param, "invalid_value");
                    }

                    if (!functionCalls.TryAdd(call.CallId, i))
                    {
                        throw ResponsesApiException.BadRequest($"{param}: call_id '{call.CallId}' appears twice.", $"{param}.call_id", "invalid_value");
                    }
                    break;
                case FunctionCallOutputItem output:
                    if (string.IsNullOrEmpty(output.CallId) || !functionCalls.ContainsKey(output.CallId))
                    {
                        throw ResponsesApiException.BadRequest($"{param}: no function_call with call_id '{output.CallId}' precedes this output.", $"{param}.call_id", "invalid_value");
                    }

                    // Parsed here so a malformed output is refused before anything runs.
                    ParseToolOutput(output.Output, $"{param}.output");

                    if (!outputs.TryAdd(output.CallId, i))
                    {
                        throw ResponsesApiException.BadRequest($"{param}: call_id '{output.CallId}' has two outputs.", $"{param}.call_id", "invalid_value");
                    }
                    break;
                case McpApprovalRequestItem request:
                    var state = _sealer.UnsealApproval(request.Id)
                        ?? throw ResponsesApiException.BadRequest($"{param}: the approval request id is not valid.", $"{param}.id", "invalid_approval");
                    if (state.CatalogId != catalogId)
                    {
                        throw ResponsesApiException.BadRequest($"{param}: the approval request belongs to another model.", $"{param}.id", "invalid_approval");
                    }

                    approvals[i] = state;
                    approvalIds.Add(request.Id!);
                    ChainOf(chains, state.CallId).Add(i);
                    break;
                case McpApprovalResponseItem answer:
                    if (answer.ApprovalRequestId == null || !approvalIds.Contains(answer.ApprovalRequestId))
                    {
                        throw ResponsesApiException.BadRequest($"{param}: no mcp_approval_request with this id precedes the response.", $"{param}.approval_request_id", "invalid_approval");
                    }

                    if (!answers.TryAdd(answer.ApprovalRequestId, answer))
                    {
                        throw ResponsesApiException.BadRequest($"{param}: the approval request has two responses.", $"{param}.approval_request_id", "invalid_approval");
                    }
                    break;
                case McpCallItem mcpCall:
                    if (string.IsNullOrEmpty(mcpCall.Id) || string.IsNullOrEmpty(mcpCall.Name))
                    {
                        throw ResponsesApiException.BadRequest($"{param}: mcp_call needs id and name.", param, "invalid_value");
                    }

                    ChainOf(chains, mcpCall.Id).Add(i);
                    break;
            }
        }

        foreach (var (callId, index) in functionCalls)
        {
            if (!outputs.ContainsKey(callId))
            {
                throw ResponsesApiException.BadRequest($"input[{index}]: no function_call_output with call_id '{callId}' follows this call.", $"input[{index}].call_id", "missing_function_call_output");
            }
        }

        // Second pass: build turns.
        var history = new List<AiInputItem?>();
        var pending = new List<(PendingResume Resume, int Turn, int Index)>();
        var turn = new Turn();
        var turnNumber = 0;
        var roundCount = 0;

        void Flush()
        {
            if (turn.IsEmpty)
            {
                turn = new Turn();
                return;
            }

            history.AddRange(turn.Items);
            foreach (var result in turn.Results)
            {
                if (result.Resume is { } resume)
                {
                    pending.Add((resume with { Slot = history.Count }, turnNumber, result.Index));
                    history.Add(null);
                }
                else
                {
                    history.Add(result.Item);
                }
            }

            if (turn.Results.Count > 0)
            {
                roundCount++;
            }

            turn = new Turn();
            turnNumber++;
        }

        void StartTurn(bool isCall)
        {
            if (turn.ResultsSeen || (!isCall && turn.Results.Count > 0))
            {
                Flush();
            }
        }

        for (var i = 0; i < items.Count; i++)
        {
            var param = $"input[{i}]";
            switch (items[i])
            {
                case MessageItem message:
                    var role = MapRole(message.Role, param);
                    var (content, files) = ParseContent(message.Content, role, param);
                    var chatMessage = new ChatMessage { Role = role, Content = content, Files = files };
                    if (role == AiChatRole.Assistant)
                    {
                        StartTurn(isCall: false);
                        turn.Items.Add(new AiInputItem.Message(chatMessage));
                        break;
                    }

                    Flush();
                    history.Add(new AiInputItem.Message(chatMessage));
                    if (role == AiChatRole.User)
                    {
                        roundCount = 0;
                    }
                    break;

                case ReasoningItem reasoning:
                    StartTurn(isCall: false);
                    // Reasoning that does not open (altered, or sealed under another key ring) is dropped.
                    if (_sealer.UnsealReasoning(reasoning.EncryptedContent) is { } state)
                    {
                        turn.Items.Add(state);
                    }
                    break;

                case FunctionCallItem call:
                    StartTurn(isCall: true);
                    turn.Items.Add(new AiInputItem.ToolCall(call.CallId!, call.Name!, string.IsNullOrWhiteSpace(call.Arguments) ? "{}" : call.Arguments));
                    var output = (FunctionCallOutputItem)items[outputs[call.CallId!]];
                    var (text, images) = ParseToolOutput(output.Output, $"input[{outputs[call.CallId!]}].output");
                    turn.Results.Add(new TurnResult(new AiInputItem.ToolResult(call.CallId!, text, false, images.Count > 0 ? images : null), null, i));
                    break;

                case McpCallItem or McpApprovalRequestItem:
                    var callId = items[i] is McpCallItem mcp ? mcp.Id! : approvals[i].CallId;
                    var chain = chains[callId];
                    if (chain[0] != i)
                    {
                        // A later item of a call placed earlier: it only supplies the result.
                        break;
                    }

                    StartTurn(isCall: true);
                    var (name, arguments) = items[i] is McpCallItem first
                        ? (first.Name!, first.Arguments)
                        : (approvals[i].Tool, approvals[i].ArgumentsJson);
                    turn.Items.Add(new AiInputItem.ToolCall(callId, name, string.IsNullOrWhiteSpace(arguments) ? "{}" : arguments));
                    turn.Results.Add(ResolveChain(items, chain, callId, approvals, answers, lastUserMessage));
                    break;

                case FunctionCallOutputItem or McpApprovalResponseItem:
                    turn.ResultsSeen = true;
                    break;
            }
        }

        Flush();

        // An answered approval without a result can only be continued where it stands, at the
        // end: a later model turn means it was already continued and its result was dropped.
        var lastTurn = turnNumber - 1;
        foreach (var (_, turnOfResume, index) in pending)
        {
            if (turnOfResume != lastTurn)
            {
                throw ResponsesApiException.BadRequest($"input[{index}]: this call was answered in an earlier response, but its result is missing from the input.", $"input[{index}]", "missing_call_result");
            }
        }

        resumes = pending.Select(p => p.Resume).ToList();
        rounds = roundCount;
        return history;
    }

    private static List<int> ChainOf(Dictionary<string, List<int>> chains, string callId)
    {
        if (!chains.TryGetValue(callId, out var chain))
        {
            chain = new List<int>();
            chains[callId] = chain;
        }

        return chain;
    }

    /// <summary>The last item of a call's chain decides its result.</summary>
    private static TurnResult ResolveChain(
        List<ResponseItem> items,
        List<int> chain,
        string callId,
        Dictionary<int, ApprovalState> approvals,
        Dictionary<string, McpApprovalResponseItem> answers,
        int lastUserMessage)
    {
        var lastIndex = chain[^1];
        var param = $"input[{lastIndex}]";

        if (items[lastIndex] is McpCallItem call)
        {
            var result = call.Error != null
                ? new AiInputItem.ToolResult(callId, call.Error, true)
                : call.Output != null
                    ? new AiInputItem.ToolResult(callId, call.Output, false)
                    : new AiInputItem.ToolResult(callId, NotCompletedText, true);
            return new TurnResult(result, null, chain[0]);
        }

        var request = (McpApprovalRequestItem)items[lastIndex];
        var state = approvals[lastIndex];
        if (!answers.TryGetValue(request.Id!, out var answer))
        {
            if (lastUserMessage > lastIndex)
            {
                return new TurnResult(new AiInputItem.ToolResult(callId, NotRespondedText, true), null, chain[0]);
            }

            throw ResponsesApiException.BadRequest($"{param}: no mcp_approval_response answers this approval request.", param, "missing_approval_response");
        }

        return new TurnResult(null, new PendingResume(-1, state, ToResumeInput(state, answer, param)), lastIndex);
    }

    private static ResumeInput ToResumeInput(ApprovalState state, McpApprovalResponseItem answer, string param)
    {
        var edited = answer.ChatuitEditedArguments;
        if (edited != null && !state.AllowEdit)
        {
            throw ResponsesApiException.BadRequest($"{param}: chatuit_edited_arguments is only accepted when the preview allows editing.", "chatuit_edited_arguments", "invalid_value");
        }

        if (!answer.Approve)
        {
            return new ResumeInput.Declined();
        }

        if (edited == null)
        {
            return new ResumeInput.Commit(Parse(state.ArgumentsJson));
        }

        JsonElement editedArguments;
        try
        {
            editedArguments = Parse(edited);
        }
        catch (JsonException ex)
        {
            throw ResponsesApiException.BadRequest($"{param}: chatuit_edited_arguments is not valid JSON: {ex.Message}", "chatuit_edited_arguments", "invalid_value");
        }

        if (editedArguments.ValueKind != JsonValueKind.Object)
        {
            throw ResponsesApiException.BadRequest($"{param}: chatuit_edited_arguments must be a JSON object.", "chatuit_edited_arguments", "invalid_value");
        }

        return new ResumeInput.Commit(editedArguments);
    }

    private static JsonElement Parse(string json)
    {
        using var document = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
        return document.RootElement.Clone();
    }

    private static AiChatRole MapRole(string? role, string param) => role switch
    {
        "user" => AiChatRole.User,
        "assistant" => AiChatRole.Assistant,
        "system" or "developer" => AiChatRole.System,
        _ => throw ResponsesApiException.BadRequest($"{param}: role '{role}' is not supported.", $"{param}.role", "unsupported_value")
    };

    /// <summary>At most this many images in one function_call_output.</summary>
    public const int MaxToolOutputImages = 4;

    /// <summary>At most this many bytes per image, decoded, in tool output and in files.</summary>
    public const int MaxImageBytes = 5 * 1024 * 1024;

    /// <summary>At most this many files in one user message, as in ChatUiT's chat.</summary>
    public const int MaxMessageFiles = 10;

    private static readonly System.Text.RegularExpressions.Regex ImageDataUrl =
        new("^data:(image/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$", System.Text.RegularExpressions.RegexOptions.Compiled);

    /// <summary>
    /// A function_call_output's output: a string, or a list of <c>input_text</c> parts and
    /// <c>input_image</c> parts whose <c>image_url</c> is a base64 data URL (png, jpeg, gif or webp).
    /// The text parts are joined with newlines.
    /// </summary>
    private static (string Text, List<ImagePart> Images) ParseToolOutput(JsonElement output, string param)
    {
        if (output.ValueKind == JsonValueKind.String)
        {
            return (output.GetString() ?? string.Empty, new List<ImagePart>());
        }

        if (output.ValueKind != JsonValueKind.Array)
        {
            throw ResponsesApiException.BadRequest($"{param}: output must be a string or an array of input_text and input_image parts.", param, "invalid_value");
        }

        var texts = new List<string>();
        var images = new List<ImagePart>();
        var index = 0;
        foreach (var part in output.EnumerateArray())
        {
            var partParam = $"{param}[{index++}]";
            var type = part.ValueKind == JsonValueKind.Object && part.TryGetProperty("type", out var t) ? t.GetString() : null;
            switch (type)
            {
                case "input_text":
                    texts.Add(part.TryGetProperty("text", out var text) && text.ValueKind == JsonValueKind.String ? text.GetString()! : string.Empty);
                    break;
                case "input_image":
                    images.Add(ParseImage(part, partParam));
                    if (images.Count > MaxToolOutputImages)
                    {
                        throw ResponsesApiException.BadRequest($"{param}: at most {MaxToolOutputImages} images per output.", param, "invalid_value");
                    }
                    break;
                default:
                    throw ResponsesApiException.BadRequest($"{partParam}: output part of type '{type}' is not supported.", $"{partParam}.type", "unsupported_value");
            }
        }

        return (string.Join("\n", texts), images);
    }

    /// <summary>An <c>input_image</c> part whose <c>image_url</c> is a base64 data URL of a png, jpeg, gif or webp image.</summary>
    private static ImagePart ParseImage(JsonElement part, string partParam)
    {
        var url = part.TryGetProperty("image_url", out var u) && u.ValueKind == JsonValueKind.String ? u.GetString()! : string.Empty;
        var match = ImageDataUrl.Match(url);
        if (!match.Success)
        {
            throw ResponsesApiException.BadRequest($"{partParam}: image_url must be a base64 data URL of a png, jpeg, gif or webp image.", $"{partParam}.image_url", "invalid_value");
        }

        if (match.Groups[2].Value.Length / 4 * 3 > MaxImageBytes)
        {
            throw ResponsesApiException.BadRequest($"{partParam}: the image is larger than {MaxImageBytes / (1024 * 1024)} MB.", $"{partParam}.image_url", "invalid_value");
        }

        return new ImagePart(match.Groups[2].Value, match.Groups[1].Value);
    }

    /// <summary>
    /// A message's content: a string, or <c>input_text</c> / <c>output_text</c> parts, joined with newlines. A user
    /// message may also hold <c>input_file</c> parts, which become the message's files as in ChatUiT's chat.
    /// </summary>
    private static (string Text, List<ChatFile> Files) ParseContent(JsonElement content, AiChatRole role, string param)
    {
        if (content.ValueKind == JsonValueKind.String)
        {
            return (content.GetString() ?? string.Empty, new List<ChatFile>());
        }

        if (content.ValueKind != JsonValueKind.Array)
        {
            throw ResponsesApiException.BadRequest($"{param}: content must be a string or an array of parts.", $"{param}.content", "invalid_value");
        }

        var texts = new List<string>();
        var files = new List<ChatFile>();
        var index = 0;
        foreach (var part in content.EnumerateArray())
        {
            var partParam = $"{param}.content[{index++}]";
            var type = part.ValueKind == JsonValueKind.Object && part.TryGetProperty("type", out var t) ? t.GetString() : null;
            switch (type)
            {
                case "input_text" or "output_text":
                    texts.Add(part.TryGetProperty("text", out var text) && text.ValueKind == JsonValueKind.String ? text.GetString()! : string.Empty);
                    break;
                case "input_file" when role == AiChatRole.User:
                    files.Add(ParseFile(part, partParam));
                    if (files.Count > MaxMessageFiles)
                    {
                        throw ResponsesApiException.BadRequest($"{param}: at most {MaxMessageFiles} files per message.", $"{param}.content", "invalid_value");
                    }
                    break;
                default:
                    throw ResponsesApiException.BadRequest($"{partParam}: content of type '{type}' is not supported.", $"{partParam}.type", "unsupported_value");
            }
        }

        return (string.Join("\n", texts), files);
    }

    /// <summary>
    /// An <c>input_file</c> part: <c>filename</c> and <c>chunks</c> of <c>input_text</c> and <c>input_image</c>
    /// parts, the content the client read from the file.
    /// </summary>
    private static ChatFile ParseFile(JsonElement part, string partParam)
    {
        var filename = part.TryGetProperty("filename", out var name) && name.ValueKind == JsonValueKind.String ? name.GetString()! : string.Empty;
        if (string.IsNullOrWhiteSpace(filename))
        {
            throw ResponsesApiException.BadRequest($"{partParam}: input_file needs a filename.", $"{partParam}.filename", "invalid_value");
        }

        if (!part.TryGetProperty("chunks", out var chunks) || chunks.ValueKind != JsonValueKind.Array)
        {
            throw ResponsesApiException.BadRequest($"{partParam}: input_file needs chunks: an array of input_text and input_image parts.", $"{partParam}.chunks", "invalid_value");
        }

        var file = new ChatFile { SourceFilename = filename };
        var index = 0;
        foreach (var chunk in chunks.EnumerateArray())
        {
            var chunkParam = $"{partParam}.chunks[{index++}]";
            var type = chunk.ValueKind == JsonValueKind.Object && chunk.TryGetProperty("type", out var t) ? t.GetString() : null;
            switch (type)
            {
                case "input_text":
                    var text = chunk.TryGetProperty("text", out var value) && value.ValueKind == JsonValueKind.String ? value.GetString()! : string.Empty;
                    file.Chunks.Add(new ChatFileChunk { Type = "text", Text = text });
                    break;
                case "input_image":
                    var image = ParseImage(chunk, chunkParam);
                    file.Chunks.Add(new ChatFileChunk { Type = "image", Base64 = image.Base64, Format = image.MediaType });
                    break;
                default:
                    throw ResponsesApiException.BadRequest($"{chunkParam}: chunk of type '{type}' is not supported.", $"{chunkParam}.type", "unsupported_value");
            }
        }

        return file;
    }

    /// <summary>One model turn being rebuilt: its assistant-side items and the results of its calls.</summary>
    private sealed class Turn
    {
        public List<AiInputItem> Items { get; } = new();

        public List<TurnResult> Results { get; } = new();

        /// <summary>A result item (function_call_output, mcp_approval_response) has been passed; the next call starts a new turn.</summary>
        public bool ResultsSeen { get; set; }

        public bool IsEmpty => Items.Count == 0 && Results.Count == 0;
    }

    /// <param name="Index">The input item reported when the result is refused.</param>
    private sealed record TurnResult(AiInputItem.ToolResult? Item, PendingResume? Resume, int Index);
}
