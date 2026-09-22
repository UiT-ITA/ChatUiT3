using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;

namespace ChatUitReact.Server.Services.Tools;

/// <summary>
/// Gets downstream access tokens for the user a generation runs for. Created at the request
/// boundary, where the principal exists, and carried into the background generation, which
/// has none. Tools ask for scopes; they never see the incoming assertion.
/// </summary>
public interface IUserTokenProvider
{
    /// <exception cref="ConsentRequiredException">The user has not consented to these scopes.</exception>
    Task<string> GetAccessTokenAsync(IReadOnlyList<string> scopes, CancellationToken cancellationToken = default);

    /// <summary>
    /// Replaces the captured principal and assertion, used after the user grants consent so the
    /// retry runs on the token from the request that carried the grant.
    /// </summary>
    void Refresh(ClaimsPrincipal user, string? incomingToken);
}

public interface IUserTokenProviderFactory
{
    /// <param name="incomingToken">The raw bearer token of the request; it becomes the On-Behalf-Of assertion.</param>
    IUserTokenProvider Create(ClaimsPrincipal user, string? incomingToken);
}

/// <summary>The user must grant the app consent for the listed scopes before the tool can run.</summary>
public sealed class ConsentRequiredException : Exception
{
    public IReadOnlyList<string> Scopes { get; }

    /// <summary>A claims challenge from Entra, when one was returned. The client can pass it to MSAL.</summary>
    public string? ClaimsChallenge { get; }

    public ConsentRequiredException(IReadOnlyList<string> scopes, string? claimsChallenge = null, Exception? inner = null)
        : base($"Consent is required for: {string.Join(", ", scopes)}", inner)
    {
        Scopes = scopes;
        ClaimsChallenge = claimsChallenge;
    }
}

/// <summary>For entry points that carry no user assertion. Every request for a token fails as a consent problem.</summary>
public sealed class NoUserTokenProvider : IUserTokenProvider
{
    public static readonly NoUserTokenProvider Instance = new();

    public Task<string> GetAccessTokenAsync(IReadOnlyList<string> scopes, CancellationToken cancellationToken = default)
        => throw new ConsentRequiredException(scopes);

    public void Refresh(ClaimsPrincipal user, string? incomingToken)
    {
    }
}
