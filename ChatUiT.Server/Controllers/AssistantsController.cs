using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ChatUiT.Server.Services;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;
using ChatUiT.Server.Services.Knowledge;
using ChatUiT.Server.Services.TokenCounting;
using Microsoft.AspNetCore.SignalR;
using ChatUiT.Server.Hubs;

namespace ChatUiT.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AssistantsController : ControllerBase
{
    private readonly IAssistantService _assistantService;
    private readonly UserService _userService;
    private readonly IModelService _modelService;
    private readonly IToolRegistry _toolRegistry;
    private readonly IToolAccessService _toolAccess;
    private readonly IKnowledgeSourceRegistry _knowledgeSources;
    private readonly IHubContext<AppHub, IAppHubClient> _hubContext;

    public AssistantsController(
        IAssistantService assistantService,
        UserService userService,
        IModelService modelService,
        IToolRegistry toolRegistry,
        IToolAccessService toolAccess,
        IKnowledgeSourceRegistry knowledgeSources,
        IHubContext<AppHub, IAppHubClient> hubContext)
    {
        _assistantService = assistantService;
        _userService = userService;
        _modelService = modelService;
        _toolRegistry = toolRegistry;
        _toolAccess = toolAccess;
        _knowledgeSources = knowledgeSources;
        _hubContext = hubContext;
    }

    /// <summary>
    /// The picker only offers allowed tools, so a disallowed or unknown id means a stale client
    /// or a hand-made request. Rejecting beats silently saving something the user did not see.
    /// Users of a shared assistant are filtered again at generation time, so this check is
    /// about the owner, not about who may later chat with it.
    /// </summary>
    private async Task<ActionResult?> RejectDisallowedToolsAsync(List<string>? toolIds)
    {
        if (toolIds == null || toolIds.Count == 0)
        {
            return null;
        }

        var check = await _toolAccess.CheckToolIdsAsync(toolIds, _userService.GetUserAccess(User));
        if (check.Ok)
        {
            return null;
        }

        return BadRequest(new
        {
            error = "tools_not_allowed",
            invalidToolIds = check.Invalid,
            disallowedToolIds = check.Disallowed
        });
    }

    /// <summary>Same reasoning as <see cref="RejectDisallowedToolsAsync"/>, for knowledge sources.</summary>
    private ActionResult? RejectDisallowedKnowledgeSources(List<string>? sourceIds)
    {
        if (sourceIds == null || sourceIds.Count == 0)
        {
            return null;
        }

        var check = _knowledgeSources.Check(sourceIds, _userService.GetUserAccess(User));
        if (check.Ok)
        {
            return null;
        }

        return BadRequest(new
        {
            error = "knowledge_sources_not_allowed",
            unknownKnowledgeSourceIds = check.Unknown,
            disallowedKnowledgeSourceIds = check.Disallowed
        });
    }

    private string GetCurrentUserId()
    {
        return _userService.GetCurrentUserId(User);
    }

    [HttpGet]
    public async Task<ActionResult<object>> GetAssistants()
    {
        var assistants = await _assistantService.GetUserAssistantsDtoAsync(_userService.GetUserIdentity(User), _userService.GetUserAccess(User));
        return Ok(assistants);
    }

    [HttpGet("{assistantId}/files/{fileId}")]
    public async Task<ActionResult<AssistantFileDto>> GetAssistantFile(string assistantId, string fileId)
    {
        var file = await _assistantService.GetAssistantFileDtoAsync(assistantId, fileId);

        if (file == null)
        {
            return NotFound("File not found");
        }

        return Ok(file);
    }

    [HttpPost]
    public async Task<ActionResult> CreateAssistant([FromBody] CreateAssistantDto createDto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (await RejectDisallowedToolsAsync(createDto.AvailableToolIds) is { } rejected)
            {
                return rejected;
            }

            if (RejectDisallowedKnowledgeSources(createDto.KnowledgeSourceIds) is { } rejectedSources)
            {
                return rejectedSources;
            }

            await _assistantService.CreateAssistantAsync(createDto, userId);

            // Notify all clients that assistant data has changed
            await _hubContext.Clients.Group(userId).AssistantsUpdated();

            return Ok();
        }
        catch (AssistantValidationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut]
    public async Task<ActionResult> UpdateAssistant([FromBody] UpdateAssistantDto updateDto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (await RejectDisallowedToolsAsync(updateDto.AvailableToolIds) is { } rejected)
            {
                return rejected;
            }

            if (RejectDisallowedKnowledgeSources(updateDto.KnowledgeSourceIds) is { } rejectedSources)
            {
                return rejectedSources;
            }

            await _assistantService.UpdateAssistantAsync(updateDto, userId);

            // Notify all clients that assistant data has changed
            await _hubContext.Clients.Group(userId).AssistantsUpdated();

            return Ok();
        }
        catch (AssistantValidationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("{assistantId}")]
    public async Task<ActionResult> DeleteAssistant(string assistantId)
    {
        var userId = GetCurrentUserId();
        await _assistantService.DeleteAssistantAsync(assistantId, userId);

        // Notify all clients that assistant data has changed
        await _hubContext.Clients.Group(userId).AssistantsUpdated();

        return Ok();
    }

    [HttpPost("{assistantId}/visibility")]
    public async Task<ActionResult> ToggleAssistantVisibility(string assistantId)
    {
        var userId = GetCurrentUserId();
        await _assistantService.ToggleAssistantVisibilityAsync(assistantId, userId);

        // Notify all clients that assistant data has changed
        await _hubContext.Clients.Group(userId).AssistantsUpdated();

        return Ok();
    }

    // Pinning is gated on the assistant's model carrying Model.AllowedAsDefault, so an expensive
    // model cannot become someone's always-on default for every new chat. It does not gate access
    // to the model itself — that is Model.AllowedRoles, enforced in ChatsController.
    [HttpPost("{assistantId}/default")]
    public async Task<ActionResult> SetDefaultAssistant(string assistantId)
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

    [HttpDelete("default")]
    public async Task<ActionResult> ClearDefaultAssistant()
    {
        var userId = GetCurrentUserId();
        await _assistantService.ClearDefaultAssistantAsync(userId);

        await _hubContext.Clients.Group(userId).AssistantsUpdated();

        return Ok();
    }

    [HttpPost("{assistantId}/favorite")]
    public async Task<ActionResult> ToggleAssistantFavorite(string assistantId)
    {
        var userId = GetCurrentUserId();
        await _assistantService.ToggleAssistantFavoriteAsync(assistantId, userId);

        // Notify all clients that assistant data has changed
        await _hubContext.Clients.Group(userId).AssistantsUpdated();

        return Ok();
    }

    [HttpPost("shared/{assistantId}")]
    public async Task<ActionResult> AddSharedAssistant(string assistantId)
    {
        try
        {
            var userId = GetCurrentUserId();
            await _assistantService.AddSharedAssistantAsync(assistantId, userId, _userService.GetUserAccess(User));

            // Notify all clients that assistant data has changed
            await _hubContext.Clients.Group(userId).AssistantsUpdated();

            return Ok();
        }
        catch (SharedAssistantRefusedException ex)
        {
            return BadRequest(new { error = "tools_not_allowed", message = ex.Message, disallowedTools = ex.DisallowedToolNames });
        }
    }

    [HttpDelete("shared/{assistantId}")]
    public async Task<ActionResult> RemoveSharedAssistant(string assistantId)
    {
        var userId = GetCurrentUserId();
        await _assistantService.RemoveSharedAssistantAsync(assistantId, userId);

        // Notify all clients that assistant data has changed
        await _hubContext.Clients.Group(userId).AssistantsUpdated();

        return Ok();
    }

    [HttpPost("{assistantId}/share-link")]
    public async Task<ActionResult<string>> GenerateShareLink(string assistantId)
    {
        var userId = GetCurrentUserId();
        var shareLink = await _assistantService.GenerateShareLinkAsync(assistantId, userId);
        return Ok(shareLink);
    }

    [HttpGet("models")]
    public async Task<ActionResult<object>> GetAvailableModels()
    {
        // Only models whose AllowedRoles match the caller's roles are returned.
        var models = await _modelService.GetModelsForUserAsync<LanguageModel>(_userService.GetUserRoles(User));
        var modelDtos = models.Select(m => new UserLanguageModelDto
        {
            Id = m.Id,
            ModelName = m.ModelName,
            Description = m.Description,
            AllowedAsDefault = m.AllowedAsDefault,
            Classification = m.Classification,
            Capabilities = new UserLanguageModelCapabilitiesDto
            {
                Vision = m.Capabilities.SupportsVision,
                Tools = m.Capabilities.SupportsFunctionCalling,
                Temperature = m.Capabilities.Temperature,
                SupportedEfforts = m.Capabilities.SupportedEfforts,
                ContextSize = m.Capabilities.MaxContextTokens,
                MaxOutputTokens = m.Capabilities.MaxOutputTokens,
                KnowledgeCutoff = m.Capabilities.KnowledgeCutoff?.ToString("yyyy-MM"),
                TokenCountingScheme = TokenCountingSchemes.IdFor(m.Capabilities)
            }
        }).ToArray();
        return Ok(modelDtos);
    }

    [HttpGet("tools")]
    public async Task<ActionResult<object>> GetAvailableTools()
    {
        var access = _userService.GetUserAccess(User);
        var result = new List<ToolDto>();
        foreach (var toolbox in await _toolAccess.GetToolboxesForUserAsync(access))
        {
            result.Add(await ToToolDtoAsync(toolbox, access));
        }

        return Ok(result);
    }

    /// <summary>A toolbox with the child toolboxes this user may use.</summary>
    private async Task<ToolDto> ToToolDtoAsync(IToolbox toolbox, UserAccess access)
    {
        var children = new List<ToolDto>();
        foreach (var child in toolbox.Children)
        {
            if (await _toolAccess.CanUseAsync(child, access))
            {
                children.Add(await ToToolDtoAsync(child, access));
            }
        }

        return ToolMapping.ToDto(toolbox, children);
    }
}
