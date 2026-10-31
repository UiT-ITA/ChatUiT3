using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;

namespace ChatUiT.Server.Services.AiProviders.Images;

using ChatUiT.Server.Models;
using ChatUiT.Server.Services.AiProviders.Protocols;

/// <summary>
/// OpenAI Images API: <c>images/generations</c> (JSON) and <c>images/edits</c> (multipart).
/// Every result is base64. With partial images the response is a server-sent event stream.
/// </summary>
public sealed class OpenAiImagesApi : IImageApi
{
    private readonly IHttpClientFactory _httpClientFactory;

    public OpenAiImagesApi(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public ImageApi Api => ImageApi.OpenAiImages;

    public async IAsyncEnumerable<ImageStreamEvent> GenerateAsync(ImageRequest request, ProtocolTarget target, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var parameters = request.Parameters;
        var baseUrl = ImageApiHttp.RequireBaseUrl(target);
        var stream = parameters.PartialImages > 0;
        var requestedFormat = parameters.OutputFormat ?? request.Model.Capabilities.OutputFormats.FirstOrDefault();

        using var message = new HttpRequestMessage(HttpMethod.Post, baseUrl + (parameters.IsEdit ? "/images/edits" : "/images/generations"))
        {
            Content = parameters.IsEdit ? BuildEditContent(request, stream) : BuildGenerationContent(request, stream)
        };
        await ImageApiHttp.AuthorizeAsync(message, target, AzureAiAuth.Scope, cancellationToken);

        using var response = await _httpClientFactory.CreateClient(ImageApiHttp.ClientName)
            .SendAsync(message, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw await ImageApiHttp.FailureAsync(response, cancellationToken);
        }

        if (stream)
        {
            await foreach (var streamEvent in ReadEventStreamAsync(response, requestedFormat, cancellationToken))
            {
                yield return streamEvent;
            }

            yield break;
        }

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        var root = document.RootElement;
        var format = ImageApiHttp.ParseFormat(ReadString(root, "output_format")) ?? requestedFormat;
        var index = 0;
        foreach (var item in root.GetProperty("data").EnumerateArray())
        {
            yield return new ImageStreamEvent.Image(index++, Convert.FromBase64String(item.GetProperty("b64_json").GetString()!), format);
        }

        if (ReadUsage(root) is { } usage)
        {
            yield return usage;
        }
    }

    private static StringContent BuildGenerationContent(ImageRequest request, bool stream)
    {
        var parameters = request.Parameters;
        var body = new JsonObject
        {
            ["model"] = request.Model.ModelId,
            ["prompt"] = parameters.Prompt,
            ["n"] = parameters.Count
        };

        foreach (var (name, value) in SettingFields(parameters, stream))
        {
            body[name] = value switch
            {
                string text => JsonValue.Create(text),
                int number => JsonValue.Create(number),
                bool flag => JsonValue.Create(flag),
                _ => throw new InvalidOperationException($"Unexpected value for {name}.")
            };
        }

        if (parameters.Moderation is { } moderation)
        {
            body["moderation"] = moderation.ToString().ToLowerInvariant();
        }

        return new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
    }

    private static MultipartFormDataContent BuildEditContent(ImageRequest request, bool stream)
    {
        var parameters = request.Parameters;
        var content = new MultipartFormDataContent
        {
            { new StringContent(request.Model.ModelId), "model" },
            { new StringContent(parameters.Prompt), "prompt" },
            { new StringContent(parameters.Count.ToString()), "n" }
        };

        foreach (var image in parameters.InputImages)
        {
            content.Add(ImageApiHttp.FileContent(image), "image[]", image.FileName);
        }

        if (parameters.Mask is { } mask)
        {
            content.Add(ImageApiHttp.FileContent(mask), "mask", mask.FileName);
        }

        if (parameters.Markup is { } markup)
        {
            content.Add(ImageApiHttp.FileContent(markup), "markup", markup.FileName);
        }

        foreach (var (name, value) in SettingFields(parameters, stream))
        {
            content.Add(new StringContent(Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture)!.ToLowerInvariant()), name);
        }

        return content;
    }

    /// <summary>The settings both endpoints take, in their wire names. Settings left to the model are not sent.</summary>
    private static IEnumerable<(string Name, object Value)> SettingFields(ImageGenerationParameters parameters, bool stream)
    {
        if (parameters.Size is { } size)
        {
            yield return ("size", $"{size.Width}x{size.Height}");
        }

        if (parameters.Quality is { } quality)
        {
            yield return ("quality", quality.ToString().ToLowerInvariant());
        }

        if (parameters.OutputFormat is { } format)
        {
            yield return ("output_format", ImageApiHttp.WireName(format));
        }

        if (parameters.Compression is { } compression)
        {
            yield return ("output_compression", compression);
        }

        if (parameters.Background is { } background)
        {
            yield return ("background", background.ToString().ToLowerInvariant());
        }

        if (stream)
        {
            yield return ("stream", true);
            yield return ("partial_images", parameters.PartialImages);
        }
    }

    /// <summary>
    /// Reads the event stream: <c>*.partial_image</c> events for the image in progress and one
    /// <c>*.completed</c> event per finished image, which also carries the usage.
    /// </summary>
    private static async IAsyncEnumerable<ImageStreamEvent> ReadEventStreamAsync(HttpResponseMessage response, ImageFormat requestedFormat, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(await response.Content.ReadAsStreamAsync(cancellationToken));
        var data = new StringBuilder();
        var imageIndex = 0;

        while (await reader.ReadLineAsync(cancellationToken) is { } line)
        {
            if (line.StartsWith("data:", StringComparison.Ordinal))
            {
                data.Append(line.AsSpan(5).TrimStart());
                continue;
            }

            if (line.Length > 0 || data.Length == 0)
            {
                continue;
            }

            var payload = data.ToString();
            data.Clear();
            if (payload == "[DONE]")
            {
                yield break;
            }

            using var document = JsonDocument.Parse(payload);
            var root = document.RootElement;
            var type = ReadString(root, "type") ?? string.Empty;
            var format = ImageApiHttp.ParseFormat(ReadString(root, "output_format")) ?? requestedFormat;

            if (type == "error" || (root.TryGetProperty("error", out var error) && error.ValueKind == JsonValueKind.Object))
            {
                var (code, message) = ImageApiHttp.ReadError(root);
                throw ImageApiHttp.Failure(null, code, message, payload);
            }

            if (type.EndsWith(".partial_image", StringComparison.Ordinal))
            {
                var partialIndex = root.TryGetProperty("partial_image_index", out var indexProperty) ? indexProperty.GetInt32() : 0;
                yield return new ImageStreamEvent.PartialImage(imageIndex, partialIndex, Convert.FromBase64String(root.GetProperty("b64_json").GetString()!), format);
            }
            else if (type.EndsWith(".completed", StringComparison.Ordinal))
            {
                yield return new ImageStreamEvent.Image(imageIndex++, Convert.FromBase64String(root.GetProperty("b64_json").GetString()!), format);
                if (ReadUsage(root) is { } usage)
                {
                    yield return usage;
                }
            }
        }
    }

    private static ImageStreamEvent.Usage? ReadUsage(JsonElement root)
    {
        if (!root.TryGetProperty("usage", out var usage) || usage.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var input = usage.TryGetProperty("input_tokens", out var inputTokens) ? inputTokens.GetInt32() : 0;
        var output = usage.TryGetProperty("output_tokens", out var outputTokens) ? outputTokens.GetInt32() : 0;
        return new ImageStreamEvent.Usage(input, output);
    }

    private static string? ReadString(JsonElement root, string name) =>
        root.TryGetProperty(name, out var property) && property.ValueKind == JsonValueKind.String ? property.GetString() : null;
}
