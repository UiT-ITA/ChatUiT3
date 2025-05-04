using System.Security.Claims;
using System.Text;

namespace ChatUitReact.Server.Services;

public class UserService
{
    private readonly ILogger<UserService> _logger;

    public UserService(ILogger<UserService> logger)
    {
        _logger = logger;
    }

    public string GetCurrentUserId(ClaimsPrincipal user)
    {
        // Log all claims for debugging
        var claimsLog = new StringBuilder("User claims:");
        foreach (var claim in user.Claims)
        {
            claimsLog.AppendLine($" - {claim.Type}: {claim.Value}");
        }
        _logger.LogInformation(claimsLog.ToString());

        // Try different claim types to find user identity
        var userId = user.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn")?.Value
            ?? user.FindFirst(ClaimTypes.Email)?.Value
            ?? user.FindFirst(ClaimTypes.Name)?.Value
            ?? user.FindFirst("preferred_username")?.Value
            ?? user.FindFirst("name")?.Value;

        if (string.IsNullOrEmpty(userId))
        {
            userId = "anonymous-user";
            _logger.LogWarning("No user identifier found in claims, using: {UserId}", userId);
        }
        else
        {
            _logger.LogInformation("Found user identifier: {UserId}", userId);
        }
        
        return userId;
    }
}