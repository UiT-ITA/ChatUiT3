using System.Collections.Generic;
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
/// The MAI Images API on Microsoft Foundry: <c>images/generations</c> (JSON, width and height)
/// and <c>images/edits</c> (multipart, prompt and images). Every request returns one PNG.
/// </summary>
public sealed class MaiImagesApi : IImageApi
{
    /// <summary>The token scope the MAI API documents for Entra authentication.</summary>
    private const string Scope = "https://cognitiveservices.azure.com/.default";

    private readonly IHttpClientFactory _httpClientFactory;

    public MaiImagesApi(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public ImageApi Api => ImageApi.MaiImages;

    public async IAsyncEnumerable<ImageStreamEvent> GenerateAsync(ImageRequest request, ProtocolTarget target, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var parameters = request.Parameters;
        var baseUrl = ImageApiHttp.RequireBaseUrl(target);

        using var message = new HttpRequestMessage(HttpMethod.Post, baseUrl + (parameters.IsEdit ? "/images/edits" : "/images/generations"))
        {
            Content = parameters.IsEdit ? BuildEditContent(request) : BuildGenerationContent(request)
        };
        await ImageApiHttp.AuthorizeAsync(message, target, Scope, cancellationToken);

        using var response = await _httpClientFactory.CreateClient(ImageApiHttp.ClientName).SendAsync(message, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw await ImageApiHttp.FailureAsync(response, cancellationToken);
        }

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        var index = 0;
        foreach (var item in document.RootElement.GetProperty("data").EnumerateArray())
        {
            yield return new ImageStreamEvent.Image(index++, Convert.FromBase64String(item.GetProperty("b64_json").GetString()!), ImageFormat.Png);
        }
    }

    private static StringContent BuildGenerationContent(ImageRequest request)
    {
        var parameters = request.Parameters;
        var size = parameters.Size ?? throw new InvalidOperationException("A MAI image generation needs a size.");
        var body = new JsonObject
        {
            ["model"] = request.Model.ModelId,
            ["prompt"] = parameters.Prompt,
            ["width"] = size.Width,
            ["height"] = size.Height
        };

        if (parameters.AutoAspectRatio)
        {
            body["auto_aspect_ratio"] = true;
        }

        if (parameters.WebGrounding)
        {
            body["web_grounding"] = true;
        }

        return new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
    }

    private static MultipartFormDataContent BuildEditContent(ImageRequest request)
    {
        var content = new MultipartFormDataContent
        {
            { new StringContent(request.Model.ModelId), "model" },
            { new StringContent(request.Parameters.Prompt), "prompt" }
        };

        foreach (var image in request.Parameters.InputImages)
        {
            content.Add(ImageApiHttp.FileContent(image), "image", image.FileName);
        }

        return content;
    }
}
