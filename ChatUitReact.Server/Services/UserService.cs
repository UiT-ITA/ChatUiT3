using System.Security.Claims;
using System.Text;

namespace ChatUitReact.Server.Services;

/// <summary>
/// Represents core user identity information extracted from claims
/// </summary>
public class UserIdentity
{
    public string UserId { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public List<string> Roles { get; set; } = new List<string>();
    public string ObjectId { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public bool IsAuthenticated { get; set; }

    public override string ToString() => 
        $"{DisplayName} ({Username}) - {(Roles.Any() ? string.Join(", ", Roles) : "No roles")}";
}

public class UserService
{
    private readonly ILogger<UserService> _logger;

    public UserService(ILogger<UserService> logger)
    {
        _logger = logger;
    }

    public string GetCurrentUserId(ClaimsPrincipal user)
    {
        return GetUserIdentity(user).UserId;
    }

    public UserIdentity GetUserIdentity(ClaimsPrincipal user)
    {
        if (user == null || !user.Identity!.IsAuthenticated)
        {
            _logger.LogWarning("Attempted to get identity for unauthenticated user");
            return new UserIdentity { IsAuthenticated = false };
        }

        var identity = new UserIdentity
        {
            IsAuthenticated = true,
            Username = user.FindFirst(ClaimTypes.Upn)?.Value 
                ?? user.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn")?.Value
                ?? user.FindFirst(ClaimTypes.Email)?.Value
                ?? "unknown",
                
            Email = user.FindFirst(ClaimTypes.Email)?.Value 
                ?? user.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn")?.Value
                ?? string.Empty,
                
            DisplayName = user.FindFirst("name")?.Value 
                ?? $"{user.FindFirst(ClaimTypes.GivenName)?.Value ?? ""} {user.FindFirst(ClaimTypes.Surname)?.Value ?? ""}".Trim()
                ?? user.FindFirst(ClaimTypes.Name)?.Value
                ?? user.FindFirst(ClaimTypes.Upn)?.Value
                ?? "Unknown User",
                
            FirstName = user.FindFirst(ClaimTypes.GivenName)?.Value 
                ?? user.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname")?.Value
                ?? string.Empty,
                
            LastName = user.FindFirst(ClaimTypes.Surname)?.Value 
                ?? user.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname")?.Value
                ?? string.Empty,
                
            ObjectId = user.FindFirst("http://schemas.microsoft.com/identity/claims/objectidentifier")?.Value ?? string.Empty,
            
            TenantId = user.FindFirst("http://schemas.microsoft.com/identity/claims/tenantid")?.Value ?? string.Empty,
            
            Roles = user.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList()
        };

        identity.UserId = identity.Username;

        return identity;
    }

    public bool UserHasRole(ClaimsPrincipal user, string role)
    {
        if (user == null || !user.Identity!.IsAuthenticated) return false;
        
        return user.IsInRole(role) || 
               user.Claims.Any(c => c.Type == ClaimTypes.Role && c.Value.Equals(role, StringComparison.OrdinalIgnoreCase));
    }
    
    public void LogAllClaims(ClaimsPrincipal user, string context = "")
    {
        if (user == null) 
        {
            _logger.LogWarning("Attempted to log claims for null user principal");
            return;
        }

        var claimsLog = new StringBuilder($"User claims{(!string.IsNullOrEmpty(context) ? $" ({context})" : "")}:");
        foreach (var claim in user.Claims)
        {
            claimsLog.AppendLine($" - {claim.Type}: {claim.Value}");
        }
        _logger.LogDebug(claimsLog.ToString());
        
        _logger.LogDebug("Authentication: {Type}, IsAuthenticated: {IsAuth}, Name: {Name}", 
            user.Identity?.AuthenticationType, 
            user.Identity?.IsAuthenticated, 
            user.Identity?.Name);
    }
}