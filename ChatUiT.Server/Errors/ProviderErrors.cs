using System.ClientModel;
using System.Net.Sockets;
using System.Text.Json;
using Anthropic.Exceptions;
using ChatUiT.Server.Services.AiProviders;

namespace ChatUiT.Server.Errors;

/// <summary>Maps a failure from an AI provider (Azure OpenAI, OpenAI, Anthropic) to its error code.</summary>
public static class ProviderErrors
{
    /// <summary>The error object of a provider response body: <c>error.code</c>, <c>error.type</c>, <c>error.message</c>, <c>error.param</c> and Azure's <c>error.innererror.code</c>.</summary>
    public sealed record ErrorBody(string? Code, string? Type, string? Message, string? Param, string? InnerCode)
    {
        public static readonly ErrorBody Empty = new(null, null, null, null, null);
    }

    private static readonly Dictionary<string, ErrorCode> CodesById = new(StringComparer.OrdinalIgnoreCase)
    {
        ["context_length_exceeded"] = ErrorCodes.ProviderContextTooLong,
        ["insufficient_quota"] = ErrorCodes.ProviderQuotaExhausted,
        ["billing_error"] = ErrorCodes.ProviderQuotaExhausted,
        ["billing_hard_limit_reached"] = ErrorCodes.ProviderQuotaExhausted,
        ["invalid_image"] = ErrorCodes.ProviderImageUnreadable,
        ["invalid_image_format"] = ErrorCodes.ProviderImageUnreadable,
        ["invalid_image_url"] = ErrorCodes.ProviderImageUnreadable,
        ["image_parse_error"] = ErrorCodes.ProviderImageUnreadable,
        ["image_too_large"] = ErrorCodes.ProviderImageUnreadable,
        ["unsupported_image"] = ErrorCodes.ProviderImageUnreadable,
        ["invalid_function_parameters"] = ErrorCodes.ProviderInvalidTool,
        ["model_not_found"] = ErrorCodes.ProviderModelNotFound,
        ["DeploymentNotFound"] = ErrorCodes.ProviderModelNotFound,
        ["request_too_large"] = ErrorCodes.ProviderRequestTooLarge,
        ["string_above_max_length"] = ErrorCodes.ProviderRequestTooLarge,
        ["invalid_api_key"] = ErrorCodes.ProviderAuthFailed,
        ["invalid_authentication"] = ErrorCodes.ProviderAuthFailed,
        ["rate_limit_exceeded"] = ErrorCodes.ProviderRateLimited,
        ["max_output_tokens"] = ErrorCodes.ProviderOutputLimitReached
    };

    private static readonly HashSet<string> ContentFilterCodes = new(StringComparer.OrdinalIgnoreCase)
    {
        "content_filter", "ResponsibleAIPolicyViolation", "content_policy_violation", "invalid_prompt"
    };

    private static readonly Dictionary<string, ErrorCode> GenericCodes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["rate_limit_error"] = ErrorCodes.ProviderRateLimited,
        ["RateLimitReached"] = ErrorCodes.ProviderRateLimited,
        ["TooManyRequests"] = ErrorCodes.ProviderRateLimited,
        ["429"] = ErrorCodes.ProviderRateLimited,
        ["authentication_error"] = ErrorCodes.ProviderAuthFailed,
        ["permission_error"] = ErrorCodes.ProviderAuthFailed,
        ["PermissionDenied"] = ErrorCodes.ProviderAuthFailed,
        ["Unauthorized"] = ErrorCodes.ProviderAuthFailed,
        ["AccessDenied"] = ErrorCodes.ProviderAuthFailed,
        ["401"] = ErrorCodes.ProviderAuthFailed,
        ["403"] = ErrorCodes.ProviderAuthFailed,
        ["not_found_error"] = ErrorCodes.ProviderModelNotFound,
        ["NotFound"] = ErrorCodes.ProviderModelNotFound,
        ["404"] = ErrorCodes.ProviderModelNotFound,
        ["overloaded_error"] = ErrorCodes.ProviderUnavailable,
        ["api_error"] = ErrorCodes.ProviderUnavailable,
        ["server_error"] = ErrorCodes.ProviderUnavailable,
        ["ServiceUnavailable"] = ErrorCodes.ProviderUnavailable,
        ["InternalServerError"] = ErrorCodes.ProviderUnavailable,
        ["500"] = ErrorCodes.ProviderUnavailable,
        ["502"] = ErrorCodes.ProviderUnavailable,
        ["503"] = ErrorCodes.ProviderUnavailable,
        ["timeout_error"] = ErrorCodes.ProviderTimeout,
        ["Timeout"] = ErrorCodes.ProviderTimeout,
        ["408"] = ErrorCodes.ProviderTimeout,
        ["504"] = ErrorCodes.ProviderTimeout
    };

    private static readonly string[] TooManyImagesPatterns = ["maximum number of images", "too many images", "too much media"];

    private static readonly string[] ImageProblemPatterns =
        ["unsupported", "invalid", "could not process", "could not be processed", "exceed", "does not match", "too large", "decode", "corrupt", "download"];

    private static readonly string[] ContextPatterns =
        ["context length", "context_length", "context window", "context limit", "maximum context", "prompt is too long"];

    private static readonly string[] ContentFilterPatterns =
        ["content management policy", "content filter", "usage policy", "ResponsibleAIPolicyViolation"];

    private static readonly string[] QuotaPatterns =
        ["exceeded your current quota", "credit balance is too low", "api usage limits"];

    private static readonly string[] ToolPatterns = ["invalid schema for function", "'tools[", "input_schema"];

    /// <summary>The code for <paramref name="exception"/>, or null when it is not a provider failure.</summary>
    public static ErrorCode? Classify(Exception exception)
    {
        switch (exception)
        {
            case AiTurnFailedException turnFailed:
                return turnFailed.Error;
            case ClientResultException result:
                return FromClientResult(result);
            case AnthropicApiException api:
                return Resolve((int)api.StatusCode, WithType(ParseBody(api.ResponseBody), api), streaming: false);
            case AnthropicSseException sse:
                return Resolve(null, WithType(ParseBody(JsonIn(sse.Message)), sse), streaming: true);
            case AnthropicIOException io:
                return FromTransport(io);
            case AnthropicException:
                return ErrorCodes.ProviderFailed;
            case HttpRequestException http when FromProviderCall(http):
                return http.StatusCode is { } status ? Resolve((int)status, ErrorBody.Empty, streaming: false) : FromTransport(http);
            case HttpIOException or SocketException when FromProviderCall(exception):
                return ErrorCodes.ProviderConnectionFailed;
            case TimeoutException when FromProviderCall(exception):
                return ErrorCodes.ProviderTimeout;
            case OperationCanceledException when IsTimeout(exception) && FromProviderCall(exception):
                return ErrorCodes.ProviderTimeout;
        }

        return null;
    }

    private static readonly string[] ProviderAssemblies = ["OpenAI", "System.ClientModel", "Anthropic"];

    private static readonly string[] ProviderNamespaces =
        ["ChatUiT.Server.Services.AiProviders.Protocols", "ChatUiT.Server.Services.AiProviders.Images"];

    /// <summary>
    /// Whether the exception, or one of its inner exceptions, passed through a provider SDK or a
    /// protocol adapter: a frame of its stack trace is in one of those assemblies or namespaces.
    /// </summary>
    private static bool FromProviderCall(Exception exception)
    {
        for (var current = exception; current != null; current = current.InnerException)
        {
            foreach (var frame in new System.Diagnostics.StackTrace(current).GetFrames())
            {
                var type = frame.GetMethod()?.DeclaringType;
                if (type == null)
                {
                    continue;
                }

                var assembly = type.Assembly.GetName().Name ?? string.Empty;
                var ns = type.Namespace ?? string.Empty;
                if (ProviderAssemblies.Any(name => assembly == name || assembly.StartsWith(name + ".", StringComparison.Ordinal))
                    || ProviderNamespaces.Any(name => ns == name || ns.StartsWith(name + ".", StringComparison.Ordinal)))
                {
                    return true;
                }
            }
        }

        return false;
    }

    /// <summary>The code for a turn the provider reported as incomplete, by its <c>incomplete_details.reason</c>.</summary>
    public static ErrorCode FromIncompleteReason(string? reason) => reason switch
    {
        "max_output_tokens" => ErrorCodes.ProviderOutputLimitReached,
        "content_filter" => ErrorCodes.ProviderOutputFiltered,
        _ => ErrorCodes.ProviderFailed
    };

    /// <summary>The code for an error the provider sent in the stream, after the response started.</summary>
    public static ErrorCode FromStreamError(string? code, string? message)
        => Resolve(null, new ErrorBody(code, null, message, null, null), streaming: true);

    /// <summary>The code for a provider error response or stream error.</summary>
    public static ErrorCode Resolve(int? status, ErrorBody body, bool streaming)
    {
        var filtered = streaming ? ErrorCodes.ProviderOutputFiltered : ErrorCodes.ProviderInputFiltered;
        var message = body.Message ?? string.Empty;

        foreach (var id in new[] { body.Code, body.InnerCode, body.Type })
        {
            if (string.IsNullOrEmpty(id))
            {
                continue;
            }

            if (ContentFilterCodes.Contains(id))
            {
                return filtered;
            }

            if (CodesById.TryGetValue(id, out var specific))
            {
                return specific;
            }
        }

        if (ContainsAny(message, TooManyImagesPatterns))
        {
            return ErrorCodes.ProviderTooManyImages;
        }

        if (ContainsAny(message, ContextPatterns))
        {
            return ErrorCodes.ProviderContextTooLong;
        }

        if (ContainsAny(message, ContentFilterPatterns))
        {
            return filtered;
        }

        if (message.Contains("image", StringComparison.OrdinalIgnoreCase) && ContainsAny(message, ImageProblemPatterns))
        {
            return ErrorCodes.ProviderImageUnreadable;
        }

        if (ContainsAny(message, QuotaPatterns))
        {
            return ErrorCodes.ProviderQuotaExhausted;
        }

        if (body.Param?.StartsWith("tools", StringComparison.OrdinalIgnoreCase) == true
            || message.StartsWith("tools.", StringComparison.OrdinalIgnoreCase)
            || ContainsAny(message, ToolPatterns))
        {
            return ErrorCodes.ProviderInvalidTool;
        }

        foreach (var id in new[] { body.Code, body.InnerCode, body.Type })
        {
            if (!string.IsNullOrEmpty(id) && GenericCodes.TryGetValue(id, out var generic))
            {
                return generic;
            }
        }

        return status switch
        {
            401 or 403 => ErrorCodes.ProviderAuthFailed,
            402 => ErrorCodes.ProviderQuotaExhausted,
            404 => ErrorCodes.ProviderModelNotFound,
            408 or 504 => ErrorCodes.ProviderTimeout,
            413 => ErrorCodes.ProviderRequestTooLarge,
            429 => ErrorCodes.ProviderRateLimited,
            >= 500 => ErrorCodes.ProviderUnavailable,
            >= 400 => ErrorCodes.ProviderBadRequest,
            _ => ErrorCodes.ProviderFailed
        };
    }

    /// <summary>The error object of a provider response body, or null when the body is not one.</summary>
    public static ErrorBody? ParseBody(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Object
                || !document.RootElement.TryGetProperty("error", out var error))
            {
                return null;
            }

            if (error.ValueKind == JsonValueKind.String)
            {
                return ErrorBody.Empty with { Message = error.GetString() };
            }

            if (error.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            var inner = error.TryGetProperty("innererror", out var innerError) && innerError.ValueKind == JsonValueKind.Object
                ? Text(innerError, "code")
                : null;
            return new ErrorBody(Text(error, "code"), Text(error, "type"), Text(error, "message"), Text(error, "param"), inner);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? Text(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value))
        {
            return null;
        }

        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number => value.GetRawText(),
            _ => null
        };
    }

    /// <summary>The code of an OpenAI SDK failure: no response, or an error response and its body.</summary>
    private static ErrorCode FromClientResult(ClientResultException exception)
    {
        if (exception.Status == 0)
        {
            return FromTransport(exception);
        }

        var body = ParseBody(ReadBody(exception)) ?? ErrorBody.Empty;
        return Resolve(exception.Status, body.Message == null ? body with { Message = exception.Message } : body, streaming: false);
    }

    private static string? ReadBody(ClientResultException exception)
    {
        try
        {
            return exception.GetRawResponse()?.Content?.ToString();
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }

    /// <summary>The body with the Anthropic SDK's error type when the body has none.</summary>
    private static ErrorBody WithType(ErrorBody? body, AnthropicServiceException exception)
    {
        body ??= ErrorBody.Empty;
        if (body.Type != null || exception.ErrorType is not { } type)
        {
            return body;
        }

        return body with { Type = type.ToString() switch
        {
            "InvalidRequestError" => "invalid_request_error",
            "AuthenticationError" => "authentication_error",
            "PermissionError" => "permission_error",
            "NotFoundError" => "not_found_error",
            "RateLimitError" => "rate_limit_error",
            "TimeoutError" => "timeout_error",
            "OverloadedError" => "overloaded_error",
            "ApiError" => "api_error",
            "BillingError" => "billing_error",
            _ => null
        } };
    }

    /// <summary>The JSON object inside an SDK message such as "SSE error returned from server: '{...}'".</summary>
    private static string? JsonIn(string message)
    {
        var start = message.IndexOf('{');
        var end = message.LastIndexOf('}');
        return start >= 0 && end > start ? message[start..(end + 1)] : null;
    }

    private static ErrorCode FromTransport(Exception exception)
        => IsTimeout(exception) ? ErrorCodes.ProviderTimeout : ErrorCodes.ProviderConnectionFailed;

    /// <summary>Whether the exception or one of its inner exceptions is a timeout.</summary>
    private static bool IsTimeout(Exception exception)
    {
        for (var current = exception; current != null; current = current.InnerException)
        {
            if (current is TimeoutException
                || (current is OperationCanceledException && current.Message.Contains("timeout", StringComparison.OrdinalIgnoreCase)))
            {
                return true;
            }
        }

        return false;
    }

    private static bool ContainsAny(string text, string[] patterns)
        => patterns.Any(pattern => text.Contains(pattern, StringComparison.OrdinalIgnoreCase));
}
