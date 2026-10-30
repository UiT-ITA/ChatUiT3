using System.Collections.Concurrent;
using Azure.Core;

namespace ChatUiT.Server.Services;

/// <summary>
/// Wraps a credential and reuses each scope's token until five minutes before it expires.
/// Requests that carry claims (a claims challenge) always go to the wrapped credential.
/// </summary>
public sealed class CachingTokenCredential : TokenCredential
{
    private static readonly TimeSpan RefreshMargin = TimeSpan.FromMinutes(5);

    private readonly TokenCredential _inner;
    private readonly ConcurrentDictionary<string, AccessToken> _tokens = new();

    public CachingTokenCredential(TokenCredential inner)
    {
        _inner = inner;
    }

    public override AccessToken GetToken(TokenRequestContext requestContext, CancellationToken cancellationToken)
    {
        var key = CacheKey(requestContext);
        if (key != null && TryGetCached(key, out var cached))
        {
            return cached;
        }

        var token = _inner.GetToken(requestContext, cancellationToken);
        if (key != null)
        {
            _tokens[key] = token;
        }
        return token;
    }

    public override async ValueTask<AccessToken> GetTokenAsync(TokenRequestContext requestContext, CancellationToken cancellationToken)
    {
        var key = CacheKey(requestContext);
        if (key != null && TryGetCached(key, out var cached))
        {
            return cached;
        }

        var token = await _inner.GetTokenAsync(requestContext, cancellationToken);
        if (key != null)
        {
            _tokens[key] = token;
        }
        return token;
    }

    /// <summary>The scopes and tenant as one key, or null when the request carries claims.</summary>
    private static string? CacheKey(TokenRequestContext requestContext) =>
        string.IsNullOrEmpty(requestContext.Claims)
            ? $"{requestContext.TenantId}|{string.Join(' ', requestContext.Scopes)}"
            : null;

    private bool TryGetCached(string key, out AccessToken token) =>
        _tokens.TryGetValue(key, out token) && token.ExpiresOn - RefreshMargin > DateTimeOffset.UtcNow;
}
