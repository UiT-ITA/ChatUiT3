using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ChatUitReact.Server.Services;
using ChatUitReact.Server.Models;
using Microsoft.AspNetCore.SignalR;
using ChatUitReact.Server.Hubs;

namespace ChatUitReact.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AssistantsController : ControllerBase
{
    private readonly IAssistantService _assistantService;
    private readonly UserService _userService;
    private readonly ILogger<AssistantsController> _logger;
    private readonly IModelService _modelService;
    private readonly IHubContext<ChatHub, IChatHubClient> _hubContext;

    public AssistantsController(
        IAssistantService assistantService,
        UserService userService,
        ILogger<AssistantsController> logger,
        IModelService modelService,
        IHubContext<ChatHub, IChatHubClient> hubContext)
    {
        _assistantService = assistantService;
        _userService = userService;
        _logger = logger;
        _modelService = modelService;
        _hubContext = hubContext;
    }

    private string GetCurrentUserId()
    {
        return _userService.GetCurrentUserId(User);
    }

    [HttpGet]
    public async Task<ActionResult<object>> GetAssistants()
    {
        try
        {
            var userId = GetCurrentUserId();
            var assistants = await _assistantService.GetUserAssistantsDtoAsync(userId);
            return Ok(assistants);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting assistants");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPost]
    public async Task<ActionResult> CreateAssistant([FromBody] CreateAssistantDto createDto)
    {
        try
        {
            var userId = GetCurrentUserId();
            await _assistantService.CreateAssistantAsync(createDto, userId);
            
            // Notify all clients that assistant data has changed
            await _hubContext.Clients.Group(userId).AssistantsChanged();
            
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating assistant");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPut]
    public async Task<ActionResult> UpdateAssistant([FromBody] UpdateAssistantDto updateDto)
    {
        try
        {
            var userId = GetCurrentUserId();
            await _assistantService.UpdateAssistantAsync(updateDto, userId);
            
            // Notify all clients that assistant data has changed
            await _hubContext.Clients.Group(userId).AssistantsChanged();
            
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating assistant");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpDelete("{assistantId}")]
    public async Task<ActionResult> DeleteAssistant(string assistantId)
    {
        try
        {
            var userId = GetCurrentUserId();
            await _assistantService.DeleteAssistantAsync(assistantId, userId);
            
            // Notify all clients that assistant data has changed
            await _hubContext.Clients.Group(userId).AssistantsChanged();
            
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting assistant");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPost("{assistantId}/visibility")]
    public async Task<ActionResult> ToggleAssistantVisibility(string assistantId)
    {
        try
        {
            var userId = GetCurrentUserId();
            await _assistantService.ToggleAssistantVisibilityAsync(assistantId, userId);
            
            // Notify all clients that assistant data has changed
            await _hubContext.Clients.Group(userId).AssistantsChanged();
            
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error toggling assistant visibility");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPost("shared/{assistantId}")]
    public async Task<ActionResult> AddSharedAssistant(string assistantId)
    {
        try
        {
            var userId = GetCurrentUserId();
            await _assistantService.AddSharedAssistantAsync(assistantId, userId);
            
            // Notify all clients that assistant data has changed
            await _hubContext.Clients.Group(userId).AssistantsChanged();
            
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding shared assistant");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPost("{assistantId}/share-link")]
    public async Task<ActionResult<string>> GenerateShareLink(string assistantId)
    {
        try
        {
            var userId = GetCurrentUserId();
            var shareLink = await _assistantService.GenerateShareLinkAsync(assistantId, userId);
            return Ok(shareLink);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating share link");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpGet("models")]
    public async Task<ActionResult<object>> GetAvailableModels()
    {
        try
        {
            var models = await _modelService.GetAllModelsAsync();
            var modelDtos = models.Select(m => new ModelDto
            {
                Id = m.Id,
                ModelName = m.ModelName,
                EndpointId = m.EndpointId,
                AllowedRoles = m.AllowedRoles
            }).ToArray();
            return Ok(modelDtos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting available models");
            return StatusCode(500, "Internal server error");
        }
    }
}
