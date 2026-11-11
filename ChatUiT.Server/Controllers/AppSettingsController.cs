using ChatUiT.Server.Models;
using ChatUiT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ChatUiT.Server.Services.Training;

namespace ChatUiT.Server.Controllers;

// The parts of the app settings that every signed-in user needs, e.g. to preselect
// the default model when creating an assistant.
[ApiController]
[Route("api/app-settings")]
[AllowWithoutTraining]
[Authorize]
public class AppSettingsController : ControllerBase
{
    private readonly ISettingsService _settingsService;

    public AppSettingsController(ISettingsService settingsService)
    {
        _settingsService = settingsService;
    }

    [HttpGet]
    public async Task<ActionResult<PublicAppSettingsDto>> GetSettings()
    {
        var settings = await _settingsService.GetEffectiveAppSettingsAsync();
        return Ok(new PublicAppSettingsDto
        {
            DefaultModelId = settings.DefaultModelId,
            DefaultAssistantId = settings.DefaultAssistantId
        });
    }
}
