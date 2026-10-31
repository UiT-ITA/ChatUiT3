using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Azure.Core;

namespace ChatUiT.Server.Services.AiProviders.Images;

using ChatUiT.Server.Models;
using ChatUiT.Server.Services.AiProviders.Protocols;

/// <summary>The HTTP plumbing the image API adapters share: the client, auth, formats and errors.</summary>
public static class ImageApiHttp
{
    /// <summary>The named HttpClient the image adapters use. It has no timeout; the run's token ends a request.</summary>
    public const string ClientName = "ImageApis";

    /// <summary>Error codes the image APIs use when a content filter blocks the prompt, an input image or the result.</summary>
    private static readonly HashSet<string> ContentFilterCodes = new(StringComparer.OrdinalIgnoreCase)
    {
        "contentFilter",
        "content_filter",
        "content_policy_violation",
        "moderation_blocked"
    };

    /// <summary>Adds the endpoint's key, or an Entra token for <paramref name="scope"/> when the endpoint uses the app's identity.</summary>
    public static async Task AuthorizeAsync(HttpRequestMessage request, ProtocolTarget target, string scope, CancellationToken cancellationToken)
    {
        if (target.Credential != null)
        {
            var token = await target.Credential.GetTokenAsync(new TokenRequestContext([scope]), cancellationToken);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);
        }
        else
        {
            request.Headers.Add("api-key", target.ApiKey);
        }
    }

    public static string RequireBaseUrl(ProtocolTarget target) =>
        string.IsNullOrWhiteSpace(target.BaseUrl)
            ? throw new InvalidOperationException("The image API needs a base URL.")
            : target.BaseUrl.TrimEnd('/');

    public static string WireName(ImageFormat format) => format switch
    {
        ImageFormat.Png => "png",
        ImageFormat.Jpeg => "jpeg",
        ImageFormat.Webp => "webp",
        _ => throw new ArgumentOutOfRangeException(nameof(format), format, null)
    };

    public static ImageFormat? ParseFormat(string? wireName) => wireName?.ToLowerInvariant() switch
    {
        "png" => ImageFormat.Png,
        "jpeg" or "jpg" => ImageFormat.Jpeg,
        "webp" => ImageFormat.Webp,
        _ => null
    };

    public static string MediaType(ImageFormat format) => format switch
    {
        ImageFormat.Png => "image/png",
        ImageFormat.Jpeg => "image/jpeg",
        ImageFormat.Webp => "image/webp",
        _ => throw new ArgumentOutOfRangeException(nameof(format), format, null)
    };

    public static ByteArrayContent FileContent(ImageInput image)
    {
        var content = new ByteArrayContent(image.Content);
        content.Headers.ContentType = new MediaTypeHeaderValue(MediaType(image.Format));
        return content;
    }

    /// <summary>Turns an unsuccessful response into an <see cref="ImageGenerationFailedException"/> with the service's reason.</summary>
    public static async Task<ImageGenerationFailedException> FailureAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        var (code, message) = ReadError(body);
        return Failure(response.StatusCode, code, message, body);
    }

    /// <summary>The <c>error</c> object of an error body or stream event: its code and message.</summary>
    public static (string? Code, string? Message) ReadError(string body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            return ReadError(document.RootElement);
        }
        catch (JsonException)
        {
            return (null, null);
        }
    }

    public static (string? Code, string? Message) ReadError(JsonElement root)
    {
        var error = root.TryGetProperty("error", out var nested) && nested.ValueKind == JsonValueKind.Object ? nested : root;
        var code = error.TryGetProperty("code", out var codeProperty) && codeProperty.ValueKind == JsonValueKind.String ? codeProperty.GetString() : null;
        var message = error.TryGetProperty("message", out var messageProperty) && messageProperty.ValueKind == JsonValueKind.String ? messageProperty.GetString() : null;
        return (code, message);
    }

    public static ImageGenerationFailedException Failure(HttpStatusCode? status, string? code, string? message, string serviceResponse)
    {
        if (code != null && ContentFilterCodes.Contains(code))
        {
            return new ImageGenerationFailedException($"The content filter blocked the request. {message}".Trim(), serviceResponse);
        }

        if (status == HttpStatusCode.TooManyRequests)
        {
            return new ImageGenerationFailedException("The image service is busy. Try again in a minute.", serviceResponse);
        }

        var reason = string.IsNullOrWhiteSpace(message) ? "no reason given" : message;
        return status is { } statusCode
            ? new ImageGenerationFailedException($"The image service returned {(int)statusCode}: {reason}", serviceResponse)
            : new ImageGenerationFailedException($"The image service failed: {reason}", serviceResponse);
    }
}
