using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using Microsoft.Identity.Web;

namespace ChatUitReact.Server.Services.Directory;

public interface IGroupDirectoryService
{
    /// <summary>Groups whose display name starts with the text, or the one group with that object id.</summary>
    Task<IReadOnlyList<DirectoryGroupDto>> SearchAsync(string query, CancellationToken ct = default);

    /// <summary>Names for stored ids. Ids that no longer resolve are returned with a null name.</summary>
    Task<IReadOnlyList<DirectoryGroupDto>> ResolveAsync(IEnumerable<string> ids, CancellationToken ct = default);
}

/// <summary>
/// Entra group lookup for the admin pages, app-only: the API's own identity with the
/// Group.ReadBasic.All application permission, so it does not depend on the admin's own
/// directory rights. Scoped because <see cref="ITokenAcquisition"/> is scoped.
/// </summary>
public sealed class GroupDirectoryService : IGroupDirectoryService
{
    private const string GraphBase = "https://graph.microsoft.com/v1.0/";
    private const string Select = "$select=id,displayName,description,mail";
    private static readonly string[] AppScopes = ["https://graph.microsoft.com/.default"];

    private readonly ITokenAcquisition _tokens;
    private readonly IHttpClientFactory _http;

    public GroupDirectoryService(ITokenAcquisition tokens, IHttpClientFactory http)
    {
        _tokens = tokens;
        _http = http;
    }

    public async Task<IReadOnlyList<DirectoryGroupDto>> SearchAsync(string query, CancellationToken ct = default)
    {
        var text = (query ?? string.Empty).Trim().Replace("\"", string.Empty);
        if (text.Length == 0)
        {
            return [];
        }

        if (Guid.TryParse(text, out var id))
        {
            var one = await GetGroupAsync(id.ToString(), ct);
            return one == null ? [] : [one];
        }

        using var response = await SendAsync($"groups?$search=\"displayName:{Uri.EscapeDataString(text)}\"&$top=20&$orderby=displayName&{Select}", eventual: true, ct);
        return response == null ? [] : Items(response.RootElement).Select(Map).ToList();
    }

    public async Task<IReadOnlyList<DirectoryGroupDto>> ResolveAsync(IEnumerable<string> ids, CancellationToken ct = default)
    {
        var result = new List<DirectoryGroupDto>();
        foreach (var raw in ids.Select(i => i?.Trim()).Where(i => !string.IsNullOrEmpty(i)).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var found = Guid.TryParse(raw, out var id) ? await GetGroupAsync(id.ToString(), ct) : null;
            result.Add(found ?? new DirectoryGroupDto { Id = raw!, DisplayName = null });
        }

        return result;
    }

    private async Task<DirectoryGroupDto?> GetGroupAsync(string id, CancellationToken ct)
    {
        using var response = await SendAsync($"groups/{id}?{Select}", eventual: false, ct);
        return response == null ? null : Map(response.RootElement);
    }

    /// <summary>Null on 404 only; other failures throw with Graph's message.</summary>
    private async Task<JsonDocument?> SendAsync(string path, bool eventual, CancellationToken ct)
    {
        var token = await _tokens.GetAccessTokenForAppAsync(AppScopes[0], tokenAcquisitionOptions: new TokenAcquisitionOptions { CancellationToken = ct });

        using var request = new HttpRequestMessage(HttpMethod.Get, GraphBase + path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (eventual)
        {
            request.Headers.Add("ConsistencyLevel", "eventual");
        }

        using var response = await _http.CreateClient(nameof(GroupDirectoryService)).SendAsync(request, ct);
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }

        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Microsoft Graph returned {(int)response.StatusCode} for group lookup: {ExtractError(body)}");
        }

        return JsonDocument.Parse(body);
    }

    private static IEnumerable<JsonElement> Items(JsonElement root)
        => root.TryGetProperty("value", out var array) && array.ValueKind == JsonValueKind.Array ? array.EnumerateArray() : [];

    private static DirectoryGroupDto Map(JsonElement group) => new()
    {
        Id = group.GetProperty("id").GetString() ?? string.Empty,
        DisplayName = group.TryGetProperty("displayName", out var n) ? n.GetString() : null,
        Description = group.TryGetProperty("description", out var d) ? d.GetString() : null,
        Mail = group.TryGetProperty("mail", out var m) ? m.GetString() : null
    };

    private static string ExtractError(string body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            if (document.RootElement.TryGetProperty("error", out var error) && error.TryGetProperty("message", out var message))
            {
                return message.GetString() ?? string.Empty;
            }
        }
        catch (JsonException)
        {
        }

        return body.Length > 300 ? body[..300] : body;
    }
}
