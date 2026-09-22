using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers;

// The signed-in user's own profile: the facts prompt snippets may read.
[ApiController]
[Route("api/users/me/profile")]
[Authorize]
public class UsersController : ControllerBase
{
    private const int NameMaxLength = 200;
    private const int AnswerPreferencesMaxLength = 2000;

    private readonly IDatabaseService _databaseService;
    private readonly UserService _userService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(IDatabaseService databaseService, UserService userService, ILogger<UsersController> logger)
    {
        _databaseService = databaseService;
        _userService = userService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<UserProfileDto>> GetProfile()
    {
        try
        {
            var user = await _databaseService.GetUserAsync(_userService.GetCurrentUserId(User));
            return Ok(MapToDto(user?.Preferences.Profile ?? new UserProfile()));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user profile");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPut]
    public async Task<ActionResult<UserProfileDto>> UpdateProfile([FromBody] UserProfileDto request)
    {
        try
        {
            var user = await _databaseService.GetUserAsync(_userService.GetCurrentUserId(User));
            if (user == null)
            {
                return NotFound();
            }

            user.Preferences.Profile = new UserProfile
            {
                DisplayName = Clamp(request.DisplayName, NameMaxLength),
                JobRole = Clamp(request.JobRole, NameMaxLength),
                AnswerPreferences = Clamp(request.AnswerPreferences, AnswerPreferencesMaxLength)
            };

            await _databaseService.UpdateUserAsync(user);
            return Ok(MapToDto(user.Preferences.Profile));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user profile");
            return StatusCode(500, "Internal server error");
        }
    }

    private static string Clamp(string? value, int maxLength)
    {
        var trimmed = (value ?? string.Empty).Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    private static UserProfileDto MapToDto(UserProfile profile) => new()
    {
        DisplayName = profile.DisplayName,
        JobRole = profile.JobRole,
        AnswerPreferences = profile.AnswerPreferences
    };
}
