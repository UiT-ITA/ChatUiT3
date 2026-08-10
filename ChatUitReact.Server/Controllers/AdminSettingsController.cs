using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers;

[ApiController]
[Route("api/admin/settings")]
[Authorize(Roles = "Admin")]
public class AdminSettingsController : ControllerBase
{
    private readonly ISettingsService _settingsService;
    private readonly IModelService _modelService;
    private readonly ILogger<AdminSettingsController> _logger;

    public AdminSettingsController(
        ISettingsService settingsService,
        IModelService modelService,
        ILogger<AdminSettingsController> logger)
    {
        _settingsService = settingsService;
        _modelService = modelService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<AppSettingsDto>> GetSettings()
    {
        try
        {
            // Effective, so the page shows the model actually in use rather than a blank selection
            var settings = await _settingsService.GetEffectiveAppSettingsAsync();
            return Ok(new AppSettingsDto
            {
                DefaultModelId = settings.DefaultModelId,
                ChatNamingModelId = settings.ChatNamingModelId
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting app settings");
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }

    [HttpPut]
    public async Task<ActionResult<AppSettingsDto>> UpdateSettings(UpdateAppSettingsDto updateDto)
    {
        try
        {
            if (!await IsKnownModelAsync(updateDto.DefaultModelId))
            {
                return BadRequest($"Unknown model id {updateDto.DefaultModelId}");
            }

            if (!await IsKnownModelAsync(updateDto.ChatNamingModelId))
            {
                return BadRequest($"Unknown model id {updateDto.ChatNamingModelId}");
            }

            var settings = new AppSettings
            {
                DefaultModelId = updateDto.DefaultModelId,
                ChatNamingModelId = updateDto.ChatNamingModelId
            };

            await _settingsService.UpdateAppSettingsAsync(settings);

            return Ok(new AppSettingsDto
            {
                DefaultModelId = settings.DefaultModelId,
                ChatNamingModelId = settings.ChatNamingModelId
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating app settings");
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }

    // An empty id means "not selected" and is always valid
    private async Task<bool> IsKnownModelAsync(string modelId)
    {
        if (string.IsNullOrWhiteSpace(modelId))
        {
            return true;
        }

        return await _modelService.GetModelByIdAsync(modelId) != null;
    }
}
