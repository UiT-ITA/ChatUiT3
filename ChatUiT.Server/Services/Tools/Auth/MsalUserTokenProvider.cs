using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Identity.Client;
using Microsoft.Identity.Web;

namespace ChatUiT.Server.Services.Tools;

/// <summary>
/// On-Behalf-Of through Microsoft.Identity.Web. The principal and the raw incoming token are
/// captured at the request boundary; each acquisition opens its own DI scope because
/// <see cref="ITokenAcquisition"/> is scoped and the generation runs outside any request.
///
/// Identity.Web decides between On-Behalf-Of and a cache lookup by whether the principal
/// carries a bootstrap token. Outside a request that token has to be put there by hand, which
/// is what <see cref="WithAssertion"/> does.
/// </summary>
public sealed class MsalUserTokenProvider : IUserTokenProvider
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly Telemetry.AppTelemetry _telemetry;
    private readonly ClaimsPrincipal _user;

    public MsalUserTokenProvider(ClaimsPrincipal user, string? incomingToken, IServiceScopeFactory scopeFactory, Telemetry.AppTelemetry telemetry)
    {
        _user = WithAssertion(user, incomingToken);
        _scopeFactory = scopeFactory;
        _telemetry = telemetry;
    }

    private static ClaimsPrincipal WithAssertion(ClaimsPrincipal user, string? incomingToken)
    {
        if (string.IsNullOrEmpty(incomingToken) || user.Identity is not ClaimsIdentity identity)
        {
            return user;
        }

        if (identity.BootstrapContext is string existing && existing == incomingToken)
        {
            return user;
        }

        var clone = new ClaimsIdentity(identity) { BootstrapContext = incomingToken };
        return new ClaimsPrincipal(clone);
    }

    public async Task<string> GetAccessTokenAsync(IReadOnlyList<string> scopes, CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var tokenAcquisition = scope.ServiceProvider.GetRequiredService<ITokenAcquisition>();

        try
        {
            return await tokenAcquisition.GetAccessTokenForUserAsync(
                scopes,
                user: _user,
                tokenAcquisitionOptions: new TokenAcquisitionOptions { CancellationToken = cancellationToken });
        }
        catch (MicrosoftIdentityWebChallengeUserException ex)
        {
            throw Classify(ex.MsalUiRequiredException, scopes, ex);
        }
        catch (MsalUiRequiredException ex)
        {
            throw Classify(ex, scopes, ex);
        }
        catch (MsalClientException ex) when (ex.ErrorCode == MsalError.ClientCredentialAuthenticationTypeMustBeDefined)
        {
            _telemetry.DelegatedTokenFailed("no_client_credential", scopes, ex.ErrorCode, ex);
            throw new InvalidOperationException(
                "Delegated access is not configured on the server: the API has no client secret or certificate for the On-Behalf-Of exchange. Tell the user an administrator must configure EntraId:ClientSecret.", ex);
        }
    }

    /// <summary>
    /// <c>user_null</c> means no assertion reached MSAL. Anything else (a missing grant,
    /// conditional access) means Entra would not issue the token. Both are errors; the user is never asked.
    /// </summary>
    private Exception Classify(MsalUiRequiredException? msal, IReadOnlyList<string> scopes, Exception original)
    {
        if (msal?.ErrorCode == MsalError.UserNullError)
        {
            _telemetry.DelegatedTokenFailed("no_user_assertion", scopes, msal.ErrorCode, original);
            return new InvalidOperationException("Delegated access is not available: the server has no user assertion for On-Behalf-Of.", original);
        }

        _telemetry.DelegatedTokenFailed("token_not_issued", scopes, msal?.ErrorCode, null);
        return new TokenUnavailableException(scopes, original);
    }
}

public sealed class MsalUserTokenProviderFactory : IUserTokenProviderFactory
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly Telemetry.AppTelemetry _telemetry;

    public MsalUserTokenProviderFactory(IServiceScopeFactory scopeFactory, Telemetry.AppTelemetry telemetry)
    {
        _scopeFactory = scopeFactory;
        _telemetry = telemetry;
    }

    public IUserTokenProvider Create(ClaimsPrincipal user, string? incomingToken)
        => new MsalUserTokenProvider(user, incomingToken, _scopeFactory, _telemetry);
}
