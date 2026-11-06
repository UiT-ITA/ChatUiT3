using ChatUiT.Server.Models;
using ChatUiT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUiT.Server.Controllers;

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
    private readonly Telemetry.AppTelemetry _telemetry;

    public UsersController(IDatabaseService databaseService, UserService userService, Telemetry.AppTelemetry telemetry)
    {
        _databaseService = databaseService;
        _userService = userService;
        _telemetry = telemetry;
    }

    [HttpGet]
    public async Task<ActionResult<UserProfileDto>> GetProfile()
    {
        var user = await _databaseService.GetUserAsync(_userService.GetCurrentUserId(User));
        return Ok(MapToDto(user?.Preferences.Profile ?? new UserProfile()));
    }

    [HttpPut]
    public async Task<ActionResult<UserProfileDto>> UpdateProfile([FromBody] UserProfileDto request)
    {
        var user = await _databaseService.GetUserAsync(_userService.GetCurrentUserId(User));
        if (user == null)
        {
            return NotFound();
        }

        var previous = user.Preferences.Profile;
        user.Preferences.Profile = new UserProfile
        {
            DisplayName = Clamp(request.DisplayName, NameMaxLength),
            JobRole = Clamp(request.JobRole, NameMaxLength),
            AnswerPreferences = Clamp(request.AnswerPreferences, AnswerPreferencesMaxLength)
        };

        await _databaseService.UpdateUserAsync(user);

        var profile = user.Preferences.Profile;
        var changed = new List<string>();
        if (previous.DisplayName != profile.DisplayName) changed.Add("displayName");
        if (previous.JobRole != profile.JobRole) changed.Add("jobRole");
        if (previous.AnswerPreferences != profile.AnswerPreferences) changed.Add("answerPreferences");
        _telemetry.ProfileUpdated(changed);
        return Ok(MapToDto(user.Preferences.Profile));
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
