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
    private readonly IToolService _toolService;
    private readonly IHubContext<ChatHub, IChatHubClient> _hubContext;

    public AssistantsController(
        IAssistantService assistantService,
        UserService userService,
        ILogger<AssistantsController> logger,
        IModelService modelService,
        IToolService toolService,
        IHubContext<ChatHub, IChatHubClient> hubContext)
    {
        _assistantService = assistantService;
        _userService = userService;
        _logger = logger;
        _modelService = modelService;
        _toolService = toolService;
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
            var assistants = await _assistantService.GetUserAssistantsDtoAsync(userId, _userService.GetUserRoles(User));
            return Ok(assistants);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting assistants");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpGet("{assistantId}/files/{fileId}")]
    public async Task<ActionResult<AssistantFileDto>> GetAssistantFile(string assistantId, string fileId)
    {
        try
        {
            var file = await _assistantService.GetAssistantFileDtoAsync(assistantId, fileId);

            if (file == null)
            {
                return NotFound("File not found");
            }

            return Ok(file);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting file {FileId} for assistant {AssistantId}", fileId, assistantId);
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
            await _hubContext.Clients.Group(userId).AssistantsUpdated();

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
            await _hubContext.Clients.Group(userId).AssistantsUpdated();

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
            await _hubContext.Clients.Group(userId).AssistantsUpdated();

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
            await _hubContext.Clients.Group(userId).AssistantsUpdated();

            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error toggling assistant visibility");
            return StatusCode(500, "Internal server error");
        }
    }

    // Pinning is gated on the assistant's model carrying Model.AllowedAsDefault, so an expensive
    // model cannot become someone's always-on default for every new chat. It does not gate access
    // to the model itself — that is Model.AllowedRoles, enforced in ChatsController.
    [HttpPost("{assistantId}/default")]
    public async Task<ActionResult> SetDefaultAssistant(string assistantId)
    {
        try
        {
            var userId = GetCurrentUserId();
            var success = await _assistantService.SetDefaultAssistantAsync(assistantId, userId, _userService.GetUserRoles(User));

            if (!success)
            {
                return BadRequest("This assistant cannot be set as your default.");
            }

            await _hubContext.Clients.Group(userId).AssistantsUpdated();

            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error setting default assistant");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpDelete("default")]
    public async Task<ActionResult> ClearDefaultAssistant()
    {
        try
        {
            var userId = GetCurrentUserId();
            await _assistantService.ClearDefaultAssistantAsync(userId);

            await _hubContext.Clients.Group(userId).AssistantsUpdated();

            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error clearing default assistant");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPost("{assistantId}/favorite")]
    public async Task<ActionResult> ToggleAssistantFavorite(string assistantId)
    {
        try
        {
            var userId = GetCurrentUserId();
            await _assistantService.ToggleAssistantFavoriteAsync(assistantId, userId);

            // Notify all clients that assistant data has changed
            await _hubContext.Clients.Group(userId).AssistantsUpdated();

            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error toggling assistant favorite");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPost("shared/{assistantId}")]
    public async Task<ActionResult> AddSharedAssistant(string assistantId)
    {
        Console.WriteLine("Adding shared assistant " + assistantId);
        try
        {
            var userId = GetCurrentUserId();
            await _assistantService.AddSharedAssistantAsync(assistantId, userId);

            // Notify all clients that assistant data has changed
            await _hubContext.Clients.Group(userId).AssistantsUpdated();

            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding shared assistant");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpDelete("shared/{assistantId}")]
    public async Task<ActionResult> RemoveSharedAssistant(string assistantId)
    {
        try
        {
            var userId = GetCurrentUserId();
            await _assistantService.RemoveSharedAssistantAsync(assistantId, userId);

            // Notify all clients that assistant data has changed
            await _hubContext.Clients.Group(userId).AssistantsUpdated();

            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing shared assistant");
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
            // Only models whose AllowedRoles match the caller's roles are returned.
            var models = await _modelService.GetAvailableModelsForUserAsync(_userService.GetUserRoles(User));
            var modelDtos = models.Select(m => new UserModelDto
            {
                Id = m.Id,
                ModelName = m.ModelName,
                Description = m.Description,
                AllowedAsDefault = m.AllowedAsDefault,
                Capabilities = new UserModelCapabilitiesDto
                {
                    Vision = m.Capabilities.SupportsVision,
                    Tools = m.Capabilities.SupportsFunctionCalling,
                    Temperature = m.Capabilities.Temperature,
                    SupportedEfforts = m.Capabilities.SupportedEfforts,
                    ContextSize = m.Capabilities.MaxContextTokens,
                    MaxOutputTokens = m.Capabilities.MaxOutputTokens,
                    KnowledgeCutoff = m.Capabilities.KnowledgeCutoff?.ToString("yyyy-MM"),
                    TokenCountingScheme = m.Capabilities.TokenCountingScheme
                }
            }).ToArray();
            return Ok(modelDtos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting available models");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpGet("tools")]
    public async Task<ActionResult<object>> GetAvailableTools()
    {
        try
        {
            var tools = await _toolService.GetAvailableToolDtos();
            return Ok(tools.ToArray());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting available tools");
            return StatusCode(500, "Internal server error");
        }
    }
}
