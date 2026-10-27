using System.Security.Claims;
using ChatUiT.Server.Models;
using System.Text;

namespace ChatUiT.Server.Services;

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
    public List<string> GroupIds { get; set; } = new List<string>();
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
            
            Roles = user.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList(),
            GroupIds = GetUserGroupIds(user)
        };

        identity.UserId = identity.Username;

        return identity;
    }

    /// <summary>
    /// The application roles this user holds, as the enum that model rows are gated on.
    ///
    /// Every authenticated user counts as <see cref="UserRole.User"/> even without a
    /// matching claim: models are gated by ticking roles in the admin panel, and a tenant
    /// that emits no app-role claims would otherwise leave everyone with access to nothing.
    /// Elevated roles (Admin, Beta, Super) still have to come from a claim.
    ///
    /// Role claims that do not map to a <see cref="UserRole"/> are ignored — an unknown
    /// directory group should never silently widen access.
    ///
    /// Note this means an <see cref="UserRole.External"/> user also counts as User. If
    /// External is meant to withhold baseline access, skip the fallback for that role.
    /// </summary>
    public List<UserRole> GetUserRoles(ClaimsPrincipal user)
    {
        if (user?.Identity?.IsAuthenticated != true)
        {
            return new List<UserRole>();
        }

        var roles = user.FindAll(ClaimTypes.Role)
            .Select(claim => Enum.TryParse<UserRole>(claim.Value, ignoreCase: true, out var role)
                ? (UserRole?)role
                : null)
            .Where(role => role.HasValue)
            .Select(role => role!.Value)
            .ToHashSet();

        roles.Add(UserRole.User);

        return roles.ToList();
    }

    /// <summary>
    /// Entra group object ids from the token's <c>groups</c> claim. Empty when the tenant does
    /// not emit the claim, or when the user is in too many groups for it to fit (Entra then
    /// sends an overage marker instead). Tool policies that list groups deny such users, so
    /// the app registration should emit only groups assigned to the application.
    /// </summary>
    public List<string> GetUserGroupIds(ClaimsPrincipal user)
    {
        if (user?.Identity?.IsAuthenticated != true)
        {
            return new List<string>();
        }

        var overage = user.HasClaim(c => c.Type == "hasgroups")
            || user.FindAll("_claim_names").Any(c => c.Value.Contains("groups", StringComparison.OrdinalIgnoreCase));
        if (overage)
        {
            _logger.LogWarning("Groups claim overage for {User}; group-gated tools are unavailable to this user", user.Identity.Name);
            return new List<string>();
        }

        var groupIds = user.FindAll("groups")
            .Concat(user.FindAll("http://schemas.microsoft.com/ws/2008/06/identity/claims/groups"))
            .Select(c => c.Value)
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (groupIds.Count == 0)
        {
            // A token without a groups claim means the app registration does not emit one; group-gated access cannot work until it does.
            _logger.LogDebug("Token for {User} carries no groups claim", user.Identity.Name);
        }

        return groupIds;
    }

    /// <summary>Roles and groups together, as tool policies are evaluated against them.</summary>
    public UserAccess GetUserAccess(ClaimsPrincipal user) => new(GetUserRoles(user), GetUserGroupIds(user));

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