using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services;
using ChatUitReact.Server.Services.Agents;
using ChatUitReact.Server.Services.Tools;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers;

/// <summary>
/// Internal agents are code, so this controller only sets the model and reasoning level each one
/// runs on. The setting applies to every run of the agent: through its tool and through the
/// Responses API.
/// </summary>
[ApiController]
[Route("api/admin/internal-agents")]
[Authorize(Roles = "Admin")]
public class AdminInternalAgentsController : ControllerBase
{
    private readonly IInternalAgentRegistry _agents;
    private readonly InternalAgentSettingsService _settings;
    private readonly IModelService _models;
    private readonly ILogger<AdminInternalAgentsController> _logger;

    public AdminInternalAgentsController(
        IInternalAgentRegistry agents,
        InternalAgentSettingsService settings,
        IModelService models,
        ILogger<AdminInternalAgentsController> logger)
    {
        _agents = agents;
        _settings = settings;
        _models = models;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<InternalAgentAdminDto>>> GetAgents()
    {
        try
        {
            var result = new List<InternalAgentAdminDto>();
            foreach (var agent in _agents.Agents)
            {
                result.Add(await ToDtoAsync(agent));
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing internal agents");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<InternalAgentAdminDto>> SaveSetting(string id, [FromBody] InternalAgentSettingDto dto)
    {
        try
        {
            var agent = _agents.Find(id);
            if (agent == null)
            {
                return NotFound($"Internal agent {id} not found");
            }

            var model = string.IsNullOrWhiteSpace(dto.ModelId) ? null : await _models.GetModelByIdAsync(dto.ModelId);
            if (model == null)
            {
                return BadRequest(new { error = "unknown_model", message = "Choose the model the agent runs on." });
            }

            if (!model.Capabilities.SupportsFunctionCalling)
            {
                return BadRequest(new { error = "model_cannot_call_functions", message = $"'{model.ModelName}' does not support function calling, which an agent needs." });
            }

            // Stored as the model can honour it, the same reconciliation as assistant settings.
            await _settings.SaveAsync(new InternalAgentSetting(agent.Id, model.Id, model.Capabilities.ClampEffort(dto.ReasoningEffort), DateTime.UtcNow));
            return Ok(await ToDtoAsync(agent));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving the setting of internal agent {AgentId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    private async Task<InternalAgentAdminDto> ToDtoAsync(InternalAgent agent)
    {
        var setting = await _settings.GetAsync(agent.Id);
        return new InternalAgentAdminDto
        {
            Id = agent.Id,
            Name = agent.DisplayName,
            Description = agent.Description,
            Functions = ToolMapping.ToFunctionDtos(agent),
            ModelId = setting?.ModelId,
            ReasoningEffort = setting?.ReasoningEffort,
            UpdatedAt = setting?.UpdatedAt
        };
    }
}
