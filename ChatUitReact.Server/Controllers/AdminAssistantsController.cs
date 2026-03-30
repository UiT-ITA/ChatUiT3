using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers;

[ApiController]
[Route("api/admin/assistants")]
[Authorize(Roles = "Admin")]
public class AdminAssistantsController : ControllerBase
{
    private readonly IAssistantService _assistantService;
    private readonly ILogger<AdminAssistantsController> _logger;

    public AdminAssistantsController(
        IAssistantService assistantService,
        ILogger<AdminAssistantsController> logger)
    {
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
            var assistant = await _assistantService.CreateSystemAssistantAsync(createDto);
            return CreatedAtAction(nameof(GetAssistant), new { id = assistant.Id }, assistant);
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

            var assistant = await _assistantService.UpdateSystemAssistantAsync(id, updateDto);
            if (assistant == null)
            {
                return NotFound();
            }

            return Ok(assistant);
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
}
