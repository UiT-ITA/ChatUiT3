using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Linq;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365;

/// <summary>
/// Thin Microsoft Graph HTTP wrapper for the M365 functions: acquires the user's delegated token
/// through the invocation's <see cref="IUserTokenProvider"/>, sends, and turns failures into
/// exceptions the executor already understands (401 → consent, anything else → an error result).
/// </summary>
public sealed class GraphClient
{
    private const string BaseUrl = "https://graph.microsoft.com/v1.0/";

    private readonly IHttpClientFactory _factory;

    public GraphClient(IHttpClientFactory factory)
    {
        _factory = factory;
    }

    public async Task<JsonElement> GetAsync(ToolExecutionContext context, string path, IReadOnlyList<string> scopes, CancellationToken ct, bool eventual = false, string? preferHeader = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, BaseUrl + path.TrimStart('/'));
        if (eventual)
        {
            // Required by Graph for $search / $count on directory objects.
            request.Headers.Add("ConsistencyLevel", "eventual");
        }

        if (preferHeader != null)
        {
            request.Headers.Add("Prefer", preferHeader);
        }

        using var response = await SendAsync(context, request, scopes, ct);
        return await ReadJsonAsync(response, ct);
    }

    public async Task<JsonElement> PostAsync(ToolExecutionContext context, string path, object body, IReadOnlyList<string> scopes, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, BaseUrl + path.TrimStart('/'))
        {
            Content = new StringContent(JsonSerializer.Serialize(body, ToolJson.Options), Encoding.UTF8, "application/json")
        };

        using var response = await SendAsync(context, request, scopes, ct);
        return await ReadJsonAsync(response, ct);
    }

    /// <summary>Downloads a file's content as text, capped at <paramref name="maxBytes"/>.</summary>
    public async Task<string> GetTextAsync(ToolExecutionContext context, string path, IReadOnlyList<string> scopes, long maxBytes, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, BaseUrl + path.TrimStart('/'));
        using var response = await SendAsync(context, request, scopes, ct);

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var buffer = new System.IO.MemoryStream();
        var chunk = new byte[16 * 1024];
        int read;
        while ((read = await stream.ReadAsync(chunk, ct)) > 0)
        {
            var remaining = maxBytes - buffer.Length;
            if (remaining <= 0)
            {
                break;
            }

            buffer.Write(chunk, 0, (int)Math.Min(read, remaining));
        }

        return Encoding.UTF8.GetString(buffer.ToArray());
    }

    public async Task<JsonElement> PutTextAsync(ToolExecutionContext context, string path, string content, string mediaType, IReadOnlyList<string> scopes, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, BaseUrl + path.TrimStart('/'))
        {
            Content = new StringContent(content, Encoding.UTF8, mediaType)
        };

        using var response = await SendAsync(context, request, scopes, ct);
        return await ReadJsonAsync(response, ct);
    }

    private async Task<HttpResponseMessage> SendAsync(ToolExecutionContext context, HttpRequestMessage request, IReadOnlyList<string> scopes, CancellationToken ct)
    {
        var token = await context.Tokens.GetAccessTokenAsync(scopes, ct);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var client = _factory.CreateClient(nameof(GraphClient));
        var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);

        if (response.IsSuccessStatusCode)
        {
            return response;
        }

        var body = await response.Content.ReadAsStringAsync(ct);
        response.Dispose();

        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            throw new ConsentRequiredException(scopes);
        }

        throw new GraphRequestException(response.StatusCode, ExtractError(body));
    }

    private static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response, CancellationToken ct)
    {
        if (response.StatusCode == HttpStatusCode.NoContent || response.Content.Headers.ContentLength == 0)
        {
            return default;
        }

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        return document.RootElement.Clone();
    }

    private static string ExtractError(string body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            if (document.RootElement.TryGetProperty("error", out var error))
            {
                var code = error.TryGetProperty("code", out var c) ? c.GetString() : null;
                var message = error.TryGetProperty("message", out var m) ? m.GetString() : null;
                return string.Join(": ", new[] { code, message }.Where(s => !string.IsNullOrWhiteSpace(s))!);
            }
        }
        catch (JsonException)
        {
        }

        return body.Length > 300 ? body[..300] : body;
    }
}

public sealed class GraphRequestException : Exception
{
    public GraphRequestException(HttpStatusCode status, string detail)
        : base($"Microsoft Graph returned {(int)status} {status}: {detail}")
    {
        Status = status;
    }

    public HttpStatusCode Status { get; }
}

/// <summary>Small helpers for reading Graph payloads without a typed SDK.</summary>
public static class GraphJson
{
    private static readonly Regex Tags = new("<[^>]+>", RegexOptions.Compiled);

    public static string? Str(this JsonElement element, params string[] path)
    {
        var current = element;
        foreach (var segment in path)
        {
            if (current.ValueKind != JsonValueKind.Object || !current.TryGetProperty(segment, out current))
            {
                return null;
            }
        }

        return current.ValueKind switch
        {
            JsonValueKind.String => current.GetString(),
            JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False => current.GetRawText(),
            _ => null
        };
    }

    public static IEnumerable<JsonElement> Items(this JsonElement element, string property = "value")
        => element.ValueKind == JsonValueKind.Object && element.TryGetProperty(property, out var array) && array.ValueKind == JsonValueKind.Array
            ? array.EnumerateArray()
            : [];

    public static string HtmlToText(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return string.Empty;
        }

        var text = Tags.Replace(html.Replace("<br>", "\n").Replace("</p>", "\n"), string.Empty);
        return WebUtility.HtmlDecode(text).Trim();
    }
}
