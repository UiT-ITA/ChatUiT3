using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ChatUiT.Server.Services.ResponsesApi;

/// <summary>
/// Wire shapes of the OpenAI Responses-compatible API, serialised with <see cref="ResponsesJson.Options"/>
/// (snake_case). Only what the contract accepts is modelled; everything else in a request is a 400.
/// ChatUiT's own extension fields carry the <c>chatuit_</c> prefix.
/// </summary>
public static class ResponsesJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        // Clients do not always put "type" first.
        AllowOutOfOrderMetadataProperties = true
    };

    /// <summary>The <c>server_label</c> of every server tool call.</summary>
    public const string ServerLabel = "chatuit";

    /// <summary>The <c>chatuit_kind</c> of an approval request for a call the user must approve.</summary>
    public const string KindConfirmation = "confirmation";

    /// <summary>The <c>chatuit_kind</c> of an approval request for questions the user must answer.</summary>
    public const string KindQuestion = "question";

    /// <summary>A name in the API's own case: <c>DocumentEdit</c> becomes <c>document_edit</c>.</summary>
    public static string Name<T>(T value) where T : struct, Enum => JsonNamingPolicy.SnakeCaseLower.ConvertName(value.ToString());
}

public sealed class CreateResponseRequest
{
    public string? Model { get; set; }

    /// <summary>A string, or an array of items.</summary>
    public JsonElement Input { get; set; }

    public string? Instructions { get; set; }

    public List<RequestTool>? Tools { get; set; }

    public JsonElement? ToolChoice { get; set; }

    public bool? Stream { get; set; }

    public bool? Store { get; set; }

    public float? Temperature { get; set; }

    public int? MaxOutputTokens { get; set; }

    public RequestReasoning? Reasoning { get; set; }

    /// <summary>Every field the contract does not accept. A non-null value is a 400.</summary>
    [JsonExtensionData]
    public Dictionary<string, JsonElement>? Unsupported { get; set; }
}

public sealed class RequestReasoning
{
    public string? Effort { get; set; }

    [JsonExtensionData]
    public Dictionary<string, JsonElement>? Unsupported { get; set; }
}

/// <summary>A client function tool. Only <c>type: "function"</c> is accepted.</summary>
public sealed class RequestTool
{
    public string? Type { get; set; }

    public string? Name { get; set; }

    public string? Description { get; set; }

    public JsonElement? Parameters { get; set; }

    public bool? Strict { get; set; }

    [JsonExtensionData]
    public Dictionary<string, JsonElement>? Unsupported { get; set; }
}

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(MessageItem), "message")]
[JsonDerivedType(typeof(FunctionCallItem), "function_call")]
[JsonDerivedType(typeof(FunctionCallOutputItem), "function_call_output")]
[JsonDerivedType(typeof(ReasoningItem), "reasoning")]
[JsonDerivedType(typeof(McpCallItem), "mcp_call")]
[JsonDerivedType(typeof(McpApprovalRequestItem), "mcp_approval_request")]
[JsonDerivedType(typeof(McpApprovalResponseItem), "mcp_approval_response")]
public abstract class ResponseItem
{
    public string? Id { get; set; }
}

public sealed class MessageItem : ResponseItem
{
    /// <summary>user, assistant, system or developer.</summary>
    public string? Role { get; set; }

    /// <summary>A string, or <c>input_text</c> / <c>output_text</c> parts; a user message may also hold <c>input_file</c> parts.</summary>
    public JsonElement Content { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Status { get; set; }
}

public sealed class FunctionCallItem : ResponseItem
{
    public string? CallId { get; set; }

    public string? Name { get; set; }

    public string? Arguments { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Status { get; set; }
}

public sealed class FunctionCallOutputItem : ResponseItem
{
    public string? CallId { get; set; }

    /// <summary>A string, or <c>input_text</c> and <c>input_image</c> parts (base64 data URLs).</summary>
    public JsonElement Output { get; set; }
}

public sealed class ReasoningItem : ResponseItem
{
    public List<SummaryText> Summary { get; set; } = new();

    /// <summary>Sealed: the provider's reasoning state, which only this server can read.</summary>
    public string? EncryptedContent { get; set; }
}

public sealed class SummaryText
{
    public string Type { get; set; } = "summary_text";

    public string Text { get; set; } = string.Empty;
}

/// <summary>
/// A server tool call. The id is the model's tool call id, so a call that paused for approval and
/// completed later keeps its id across requests. No output and no error means the call did not
/// finish here (status <c>incomplete</c>): it paused, and an approval request with the same call follows.
/// </summary>
public sealed class McpCallItem : ResponseItem
{
    /// <summary>The approval request this call continues, when it waited for the user.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ApprovalRequestId { get; set; }

    public string ServerLabel { get; set; } = ResponsesJson.ServerLabel;

    public string? Name { get; set; }

    public string? Arguments { get; set; }

    public string? Output { get; set; }

    public string? Error { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Status { get; set; }
}

/// <summary>A server tool call paused for the user. The id is sealed state; the client echoes it back.</summary>
public sealed class McpApprovalRequestItem : ResponseItem
{
    public string ServerLabel { get; set; } = ResponsesJson.ServerLabel;

    public string? Name { get; set; }

    public string? Arguments { get; set; }

    /// <summary><see cref="ResponsesJson.KindConfirmation"/> with a preview, or <see cref="ResponsesJson.KindQuestion"/> with questions.</summary>
    public string? ChatuitKind { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ApprovalPreview? ChatuitPreview { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<ApprovalQuestion>? ChatuitQuestions { get; set; }
}

public sealed class ApprovalPreview
{
    public string Title { get; set; } = string.Empty;

    public string? Summary { get; set; }

    public List<ApprovalPreviewField> Fields { get; set; } = new();

    public bool AllowEdit { get; set; }

    /// <summary><c>general</c>, <c>message</c>, <c>file</c>, <c>document_edit</c> or <c>event</c>.</summary>
    public string Kind { get; set; } = "general";
}

public sealed class ApprovalPreviewField
{
    public string Label { get; set; } = string.Empty;

    public string Value { get; set; } = string.Empty;

    public bool Multiline { get; set; }

    /// <summary>What the field holds, in snake case (<c>recipients</c>, <c>body</c>, ...); <c>none</c> for a plain field.</summary>
    public string Role { get; set; } = "none";
}

public sealed class ApprovalQuestion
{
    public string Question { get; set; } = string.Empty;

    public List<ApprovalQuestionOption> Options { get; set; } = new();

    public bool MultiSelect { get; set; }
}

public sealed class ApprovalQuestionOption
{
    public string Label { get; set; } = string.Empty;

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Description { get; set; }
}

/// <summary>
/// The answer to an approval request. For questions, <see cref="Approve"/> false means the user
/// answered none, and true comes with <see cref="ChatuitAnswers"/>: one per question, null for a skipped one.
/// </summary>
public sealed class McpApprovalResponseItem : ResponseItem
{
    public string? ApprovalRequestId { get; set; }

    public bool Approve { get; set; }

    /// <summary>A JSON object as a string. Accepted only when the preview allowed editing.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ChatuitEditedArguments { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<ApprovalAnswer?>? ChatuitAnswers { get; set; }
}

/// <summary>The options the user picked, by label, and what they wrote themselves.</summary>
public sealed class ApprovalAnswer
{
    public List<string> Selected { get; set; } = new();

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Text { get; set; }
}

public sealed class OutputTextPart
{
    public string Type { get; set; } = "output_text";

    public string Text { get; set; } = string.Empty;

    public List<object> Annotations { get; set; } = new();
}

public sealed class ResponseObject
{
    public string Id { get; set; } = string.Empty;

    public string Object { get; set; } = "response";

    public long CreatedAt { get; set; }

    /// <summary>in_progress, completed or failed.</summary>
    public string Status { get; set; } = "in_progress";

    public string Model { get; set; } = string.Empty;

    public List<ResponseItem> Output { get; set; } = new();

    /// <summary>Always null: the providers do not report token usage.</summary>
    public object? Usage { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ResponseError? Error { get; set; }
}

public sealed class ResponseError
{
    public string Code { get; set; } = "server_error";

    public string Message { get; set; } = string.Empty;
}

public sealed class ModelObject
{
    public string Id { get; set; } = string.Empty;

    public string Object { get; set; } = "model";

    public long Created { get; set; }

    public string OwnedBy { get; set; } = "chatuit";
}

public sealed class ModelList
{
    public string Object { get; set; } = "list";

    public List<ModelObject> Data { get; set; } = new();
}

/// <summary>The body of every error: <c>{error:{message,type,param,code}}</c>.</summary>
public sealed class ErrorBody
{
    public ErrorDetail Error { get; set; } = new();
}

public sealed class ErrorDetail
{
    public string Message { get; set; } = string.Empty;

    public string Type { get; set; } = "invalid_request_error";

    public string? Param { get; set; }

    public string? Code { get; set; }
}

/// <summary>A request the API refuses, with the HTTP status and the error body fields.</summary>
public sealed class ResponsesApiException : System.Exception
{
    public ResponsesApiException(int status, string message, string? param = null, string? code = null, string type = "invalid_request_error")
        : base(message)
    {
        Status = status;
        Param = param;
        Code = code;
        Type = type;
    }

    public int Status { get; }

    public string? Param { get; }

    public string? Code { get; }

    public string Type { get; }

    public static ResponsesApiException BadRequest(string message, string? param = null, string? code = null) => new(400, message, param, code);

    public static ResponsesApiException ModelNotFound(string? model) => new(
        404, $"The model '{model}' does not exist or you do not have access to it.", "model", "model_not_found");

    public ErrorBody ToBody() => new() { Error = new ErrorDetail { Message = Message, Type = Type, Param = Param, Code = Code } };
}
