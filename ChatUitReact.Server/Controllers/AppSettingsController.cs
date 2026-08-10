using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers;

// The parts of the app settings that every signed-in user needs, e.g. to preselect
// the default model when creating an assistant.
[ApiController]
[Route("api/app-settings")]
[Authorize]
public class AppSettingsController : ControllerBase
{
    private readonly ISettingsService _settingsService;
    private readonly ILogger<AppSettingsController> _logger;

    public AppSettingsController(ISettingsService settingsService, ILogger<AppSettingsController> logger)
    {
        _settingsService = settingsService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<PublicAppSettingsDto>> GetSettings()
    {
        try
        {
            var settings = await _settingsService.GetEffectiveAppSettingsAsync();
            return Ok(new PublicAppSettingsDto
            {
                DefaultModelId = settings.DefaultModelId
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting public app settings");
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }
}
