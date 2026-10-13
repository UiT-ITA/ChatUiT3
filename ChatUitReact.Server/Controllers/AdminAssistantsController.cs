using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ChatUitReact.Server.Services.Tools;
using ChatUitReact.Server.Services.Knowledge;

namespace ChatUitReact.Server.Controllers;

[ApiController]
[Route("api/admin/assistants")]
[Authorize(Roles = "Admin")]
public class AdminAssistantsController : ControllerBase
{
    private readonly IAssistantService _assistantService;
    private readonly ILogger<AdminAssistantsController> _logger;
    private readonly IToolRegistry _toolRegistry;
    private readonly IKnowledgeSourceRegistry _knowledgeSources;

    public AdminAssistantsController(
        IAssistantService assistantService,
        IToolRegistry toolRegistry,
        IKnowledgeSourceRegistry knowledgeSources,
        ILogger<AdminAssistantsController> logger)
    {
        _toolRegistry = toolRegistry;
        _knowledgeSources = knowledgeSources;
        _assistantService = assistantService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<FullAssistantDto>>> GetAssistants()
    {
        try
        {
            var assistants = await _assistantService.GetSystemAssistantsForAdminAsync();
            return Ok(assistants);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting system assistants");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<FullAssistantDto>> GetAssistant(string id)
    {
        try
        {
            var assistant = await _assistantService.GetSystemAssistantForAdminAsync(id);
            if (assistant == null)
            {
                return NotFound();
            }

            return Ok(assistant);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting system assistant {AssistantId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPost]
    public async Task<ActionResult<FullAssistantDto>> CreateAssistant([FromBody] CreateAssistantDto createDto)
    {
        try
        {
            if (UnknownToolIds(createDto.AvailableToolIds) is { Count: > 0 } unknown)
            {
                return BadRequest(new { error = "unknown_tools", unknownToolIds = unknown });
            }

            if (UnknownKnowledgeSourceIds(createDto.KnowledgeSourceIds) is { Count: > 0 } unknownSources)
            {
                return BadRequest(new { error = "unknown_knowledge_sources", unknownKnowledgeSourceIds = unknownSources });
            }

            if (InvalidGroupIds(createDto.Access) is { Count: > 0 } invalidGroups)
            {
                return BadRequest(new { error = "invalid_group_ids", groupIds = invalidGroups });
            }

            var assistant = await _assistantService.CreateSystemAssistantAsync(createDto);
            return CreatedAtAction(nameof(GetAssistant), new { id = assistant.Id }, assistant);
        }
        catch (AssistantValidationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating system assistant");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<FullAssistantDto>> UpdateAssistant(string id, [FromBody] UpdateAssistantDto updateDto)
    {
        try
        {
            if (id != updateDto.Id)
            {
                return BadRequest("Route id does not match request body id");
            }

            if (UnknownToolIds(updateDto.AvailableToolIds) is { Count: > 0 } unknown)
            {
                return BadRequest(new { error = "unknown_tools", unknownToolIds = unknown });
            }

            if (UnknownKnowledgeSourceIds(updateDto.KnowledgeSourceIds) is { Count: > 0 } unknownSources)
            {
                return BadRequest(new { error = "unknown_knowledge_sources", unknownKnowledgeSourceIds = unknownSources });
            }

            if (InvalidGroupIds(updateDto.Access) is { Count: > 0 } invalidGroups)
            {
                return BadRequest(new { error = "invalid_group_ids", groupIds = invalidGroups });
            }

            var assistant = await _assistantService.UpdateSystemAssistantAsync(id, updateDto);
            if (assistant == null)
            {
                return NotFound();
            }

            return Ok(assistant);
        }
        catch (AssistantValidationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating system assistant {AssistantId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAssistant(string id)
    {
        try
        {
            var deleted = await _assistantService.DeleteSystemAssistantAsync(id);
            if (!deleted)
            {
                return NotFound();
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting system assistant {AssistantId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>System assistants serve everyone, so admins are not access-checked; unknown ids are still refused.</summary>
    private static List<string> InvalidGroupIds(AssistantAccessPolicyDto? access)
        => (access?.AllowedGroupIds ?? []).Where(g => !Guid.TryParse(g?.Trim(), out _)).ToList();

    private List<string> UnknownToolIds(List<string>? toolIds)
        => (toolIds ?? []).Where(id => _toolRegistry.Find(id) == null).Distinct().ToList();

    private List<string> UnknownKnowledgeSourceIds(List<string>? sourceIds)
        => (sourceIds ?? []).Where(id => _knowledgeSources.Find(id) == null).Distinct().ToList();
}
