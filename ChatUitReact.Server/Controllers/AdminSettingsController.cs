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
    private readonly IAssistantService _assistantService;
    private readonly ILogger<AdminSettingsController> _logger;

    public AdminSettingsController(
        ISettingsService settingsService,
        IModelService modelService,
        IAssistantService assistantService,
        ILogger<AdminSettingsController> logger)
    {
        _settingsService = settingsService;
        _modelService = modelService;
        _assistantService = assistantService;
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
                ChatNamingModelId = settings.ChatNamingModelId,
                DefaultAssistantId = settings.DefaultAssistantId
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

            if (!await IsSystemAssistantAsync(updateDto.DefaultAssistantId))
            {
                return BadRequest($"Unknown system assistant id {updateDto.DefaultAssistantId}");
            }

            var settings = new AppSettings
            {
                DefaultModelId = updateDto.DefaultModelId,
                ChatNamingModelId = updateDto.ChatNamingModelId,
                DefaultAssistantId = updateDto.DefaultAssistantId
            };

            await _settingsService.UpdateAppSettingsAsync(settings);

            return Ok(new AppSettingsDto
            {
                DefaultModelId = settings.DefaultModelId,
                ChatNamingModelId = settings.ChatNamingModelId,
                DefaultAssistantId = settings.DefaultAssistantId
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

    // Deliberately not checked against Model.AllowedAsDefault: that flag exists so users cannot
    // pin an expensive model, and an admin choosing the org-wide default is exactly who should
    // be trusted with that decision. Only "is this a real system assistant" is enforced.
    private async Task<bool> IsSystemAssistantAsync(string assistantId)
    {
        if (string.IsNullOrWhiteSpace(assistantId))
        {
            return true;
        }

        return await _assistantService.GetSystemAssistantForAdminAsync(assistantId) != null;
    }
}
