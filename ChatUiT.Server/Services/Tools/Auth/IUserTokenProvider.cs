using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;

namespace ChatUiT.Server.Services.Tools;

/// <summary>
/// Gets downstream access tokens for the user a generation runs for. Created at the request
/// boundary, where the principal exists, and carried into the background generation, which
/// has none. Tools ask for scopes; they never see the incoming assertion.
/// </summary>
public interface IUserTokenProvider
{
    /// <exception cref="TokenUnavailableException">Entra would not issue a token for these scopes.</exception>
    Task<string> GetAccessTokenAsync(IReadOnlyList<string> scopes, CancellationToken cancellationToken = default);
}

public interface IUserTokenProviderFactory
{
    /// <param name="incomingToken">The raw bearer token of the request; it becomes the On-Behalf-Of assertion.</param>
    IUserTokenProvider Create(ClaimsPrincipal user, string? incomingToken);
}

/// <summary>No delegated token could be obtained for the listed scopes. A configuration error: the user cannot fix it.</summary>
public sealed class TokenUnavailableException : Exception
{
    public IReadOnlyList<string> Scopes { get; }

    public TokenUnavailableException(IReadOnlyList<string> scopes, Exception? inner = null)
        : base($"No delegated token for: {string.Join(", ", scopes)}", inner)
    {
        Scopes = scopes;
    }
}

/// <summary>For entry points that carry no user assertion. Every request for a token fails.</summary>
public sealed class NoUserTokenProvider : IUserTokenProvider
{
    public static readonly NoUserTokenProvider Instance = new();

    public Task<string> GetAccessTokenAsync(IReadOnlyList<string> scopes, CancellationToken cancellationToken = default)
        => throw new TokenUnavailableException(scopes);
}
