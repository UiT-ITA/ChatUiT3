using System.Net;
using System.Text.Json;
using ChatUiT.Server.Services.AiProviders;
using ChatUiT.Server.Services.AiProviders.Images;
using ChatUiT.Server.Services.Agents.M365;
using ChatUiT.Server.Services.Tools;
using Microsoft.Azure.Cosmos;
using Microsoft.Identity.Client;

namespace ChatUiT.Server.Telemetry;

/// <summary>The <see cref="FieldNames.ErrorCategory"/> and <see cref="FieldNames.ErrorCode"/> of an exception.</summary>
public static class ErrorClassification
{
    public static string Category(Exception exception)
    {
        switch (exception)
        {
            case AiTurnFailedException turnFailed:
                return turnFailed.Category;
            case ImageGenerationFailedException imageFailed:
                return imageFailed.Category;
            case GraphRequestException graph:
                return FromStatus((int)graph.Status);
            case TokenUnavailableException or MsalException or UnauthorizedAccessException:
                return ErrorCategories.Auth;
            case CosmosException:
                return ErrorCategories.Database;
            case ToolArgumentException or ArgumentException or JsonException or FormatException:
                return ErrorCategories.Validation;
            case TimeoutException:
                return ErrorCategories.Timeout;
            case OperationCanceledException:
                return ErrorCategories.Timeout;
        }

        var name = exception.GetType().Name;
        if (name.StartsWith("Anthropic", StringComparison.Ordinal))
        {
            return name switch
            {
                "AnthropicRateLimitException" => ErrorCategories.ProviderRateLimited,
                "AnthropicBadRequestException" or "AnthropicUnprocessableEntityException" or "AnthropicNotFoundException" => ErrorCategories.ProviderBadRequest,
                "AnthropicUnauthorizedException" or "AnthropicForbiddenException" => ErrorCategories.Config,
                _ => StatusOf(exception) is { } status ? FromStatus(status) : ErrorCategories.ProviderUnavailable
            };
        }

        if (exception is HttpRequestException || name == "ClientResultException")
        {
            return StatusOf(exception) is { } status ? FromStatus(status) : ErrorCategories.ProviderUnavailable;
        }

        return ErrorCategories.Internal;
    }

    public static string? Code(Exception exception) => exception switch
    {
        AiTurnFailedException turnFailed => turnFailed.Code,
        ImageGenerationFailedException imageFailed => imageFailed.Code,
        MsalException msal => msal.ErrorCode,
        _ => StatusOf(exception)?.ToString()
    };

    /// <summary>The HTTP status an exception carries in a <c>Status</c> or <c>StatusCode</c> property.</summary>
    public static int? StatusOf(Exception exception)
    {
        var type = exception.GetType();
        var value = (type.GetProperty("StatusCode") ?? type.GetProperty("Status"))?.GetValue(exception);
        return value switch
        {
            int number when number > 0 => number,
            HttpStatusCode code => (int)code,
            _ => null
        };
    }

    public static string FromStatus(int status) => status switch
    {
        401 or 403 => ErrorCategories.Auth,
        408 => ErrorCategories.Timeout,
        429 => ErrorCategories.ProviderRateLimited,
        >= 400 and < 500 => ErrorCategories.ProviderBadRequest,
        >= 500 => ErrorCategories.ProviderUnavailable,
        _ => ErrorCategories.Internal
    };
}
