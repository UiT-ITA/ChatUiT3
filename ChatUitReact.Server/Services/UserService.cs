using System.Security.Claims;

namespace ChatUitReact.Server.Services;

public class UserService
{
    public string GetCurrentUserId(ClaimsPrincipal user)
    {
        // Get the username from the UPN claim
        var userId = user.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn")?.Value;
        
        // If using API key, we can use a fixed ID or extract it from custom claims
        if (string.IsNullOrEmpty(userId) && user.Identity?.AuthenticationType == "ApiKey")
        {
            // For demo purposes, using a fixed ID for API key users
            userId = "api-user";
        }
        
        return userId ?? "anonymous";
    }
}