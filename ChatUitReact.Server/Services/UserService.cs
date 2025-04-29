using System.Security.Claims;

namespace ChatUitReact.Server.Services;

public class UserService
{
    public string GetCurrentUserId(ClaimsPrincipal user)
    {
        // For Azure AD / Microsoft Identity
        var userIdClaim = user.FindFirst("http://schemas.microsoft.com/identity/claims/objectidentifier")?.Value
            ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        // If using API key, we can use a fixed ID or extract it from custom claims
        if (string.IsNullOrEmpty(userIdClaim) && user.Identity?.AuthenticationType == "ApiKey")
        {
            // For demo purposes, using a fixed ID for API key users
            // In production, you would want to map API keys to actual users
            userIdClaim = "api-user";
        }

        return userIdClaim ?? "anonymous";
    }
}