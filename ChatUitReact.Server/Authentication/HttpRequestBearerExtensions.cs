using System;
using Microsoft.AspNetCore.Http;

namespace ChatUitReact.Server.Authentication;

public static class HttpRequestBearerExtensions
{
    /// <summary>The raw token the request was authenticated with; it is the On-Behalf-Of assertion.</summary>
    public static string? BearerToken(this HttpRequest request)
    {
        var header = request.Headers.Authorization.ToString();
        const string prefix = "Bearer ";
        return header.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) ? header[prefix.Length..].Trim() : null;
    }
}
