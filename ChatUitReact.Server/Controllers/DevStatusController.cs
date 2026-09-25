using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers;

/// <summary>
/// Development only: what the API sees of the caller. Answers 404 in every other environment so
/// the route does not exist in production.
/// </summary>
[ApiController]
[Route("api/dev/status")]
[Authorize]
public class DevStatusController : ControllerBase
{
    private readonly IWebHostEnvironment _environment;
    private readonly UserService _userService;

    public DevStatusController(IWebHostEnvironment environment, UserService userService)
    {
        _environment = environment;
        _userService = userService;
    }

    [HttpGet]
    public ActionResult<DevStatusDto> Get()
    {
        if (!_environment.IsDevelopment())
        {
            return NotFound();
        }

        var access = _userService.GetUserAccess(User);
        return Ok(new DevStatusDto
        {
            Environment = _environment.EnvironmentName,
            UserId = _userService.GetCurrentUserId(User),
            Roles = access.Roles.Select(r => r.ToString()).ToList(),
            GroupIds = access.GroupIds.ToList(),
            GroupsOverage = User.HasClaim(c => c.Type == "hasgroups")
                || User.FindAll("_claim_names").Any(c => c.Value.Contains("groups", StringComparison.OrdinalIgnoreCase)),
            Claims = User.Claims.Select(c => new ClaimDto { Type = c.Type, Value = c.Value }).ToList()
        });
    }
}

public class DevStatusDto
{
    public string Environment { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    /// <summary>Roles as the server resolved them from the claims.</summary>
    public List<string> Roles { get; set; } = new();
    /// <summary>Group ids as the server resolved them from the claims.</summary>
    public List<string> GroupIds { get; set; } = new();
    /// <summary>The token says the user has too many groups to list; the server then treats them as having none.</summary>
    public bool GroupsOverage { get; set; }
    /// <summary>Every claim on the validated token, in order.</summary>
    public List<ClaimDto> Claims { get; set; } = new();
}

public class ClaimDto
{
    public string Type { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}
