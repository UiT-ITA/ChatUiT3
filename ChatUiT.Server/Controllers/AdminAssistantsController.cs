using ChatUiT.Server.Models;
using ChatUiT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ChatUiT.Server.Services.Tools;
using ChatUiT.Server.Services.Knowledge;

namespace ChatUiT.Server.Controllers;

[ApiController]
[Route("api/admin/assistants")]
[Authorize(Roles = "Admin")]
public class AdminAssistantsController : ControllerBase
{
    private readonly IAssistantService _assistantService;
    private readonly IToolboxRegistry _toolboxes;
    private readonly IKnowledgeSourceRegistry _knowledgeSources;

    public AdminAssistantsController(
        IAssistantService assistantService,
        IToolboxRegistry toolboxes,
        IKnowledgeSourceRegistry knowledgeSources)
    {
        _toolboxes = toolboxes;
        _knowledgeSources = knowledgeSources;
        _assistantService = assistantService;
    }

    [HttpGet]
    public async Task<ActionResult<List<FullAssistantDto>>> GetAssistants()
    {
        var assistants = await _assistantService.GetSystemAssistantsForAdminAsync();
        return Ok(assistants);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<FullAssistantDto>> GetAssistant(string id)
    {
        var assistant = await _assistantService.GetSystemAssistantForAdminAsync(id);
        if (assistant == null)
        {
            return NotFound();
        }

        return Ok(assistant);
    }

    [HttpPost]
    public async Task<ActionResult<FullAssistantDto>> CreateAssistant([FromBody] CreateAssistantDto createDto)
    {
        try
        {
            if (_toolboxes.Invalid(createDto.AvailableToolIds ?? []) is { Count: > 0 } invalid)
            {
                return BadRequest(new { error = "invalid_tools", invalidToolIds = invalid });
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

            if (_toolboxes.Invalid(updateDto.AvailableToolIds ?? []) is { Count: > 0 } invalid)
            {
                return BadRequest(new { error = "invalid_tools", invalidToolIds = invalid });
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
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAssistant(string id)
    {
        var deleted = await _assistantService.DeleteSystemAssistantAsync(id);
        if (!deleted)
        {
            return NotFound();
        }

        return NoContent();
    }

    /// <summary>System assistants serve everyone, so admins are not access-checked; unknown ids are still refused.</summary>
    private static List<string> InvalidGroupIds(AssistantAccessPolicyDto? access)
        => (access?.AllowedGroupIds ?? []).Where(g => !Guid.TryParse(g?.Trim(), out _)).ToList();

    private List<string> UnknownKnowledgeSourceIds(List<string>? sourceIds)
        => (sourceIds ?? []).Where(id => _knowledgeSources.Find(id) == null).Distinct().ToList();
}
