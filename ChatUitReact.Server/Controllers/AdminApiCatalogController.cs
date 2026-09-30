using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services;
using ChatUitReact.Server.Services.Agents;
using ChatUitReact.Server.Services.ApiCatalog;
using ChatUitReact.Server.Services.Tools;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers;

/// <summary>
/// Chooses which internal agents and raw models the Responses API serves, and to whom. An entry
/// only admits callers; the target's own rules (agent policy, model roles) still apply on top.
/// An agent's model is set under Internal agents, not here.
/// </summary>
[ApiController]
[Route("api/admin/api-catalog")]
[Authorize(Roles = "Admin")]
public class AdminApiCatalogController : ControllerBase
{
    private readonly IApiCatalogService _catalog;
    private readonly IInternalAgentRegistry _agents;
    private readonly IModelService _models;
    private readonly ILogger<AdminApiCatalogController> _logger;

    public AdminApiCatalogController(
        IApiCatalogService catalog,
        IInternalAgentRegistry agents,
        IModelService models,
        ILogger<AdminApiCatalogController> logger)
    {
        _catalog = catalog;
        _agents = agents;
        _models = models;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<ApiCatalogDto>> GetCatalog()
    {
        try
        {
            return Ok(await BuildDtoAsync());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing the API catalog");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPut("{publicId}")]
    public async Task<ActionResult<ApiCatalogDto>> SaveEntry(string publicId, [FromBody] ApiCatalogEntryDto dto)
    {
        try
        {
            if (!ApiCatalogEntry.PublicIdPattern().IsMatch(publicId))
            {
                return BadRequest(new { error = "invalid_public_id", message = "The public id must match ^[a-z0-9][a-z0-9._-]{0,63}$." });
            }

            var invalidGroups = (dto.AllowedGroupIds ?? []).Where(g => !Guid.TryParse(g?.Trim(), out _)).ToList();
            if (invalidGroups.Count > 0)
            {
                return BadRequest(new { error = "invalid_group_ids", message = "Allowed groups must be Entra group object ids.", groupIds = invalidGroups });
            }

            var existing = await _catalog.GetEntryAsync(publicId);
            if (existing != null && (existing.Kind != dto.Kind || existing.TargetId != dto.TargetId))
            {
                return BadRequest(new { error = "public_id_taken", message = $"The public id '{publicId}' is already used by another entry." });
            }

            if (dto.Kind == ApiCatalogKind.Agent)
            {
                var agent = _agents.Find(dto.TargetId);
                if (agent == null)
                {
                    return BadRequest(new { error = "unknown_target", message = $"No internal agent '{dto.TargetId}' is registered." });
                }

                if (publicId != dto.TargetId)
                {
                    return BadRequest(new { error = "invalid_public_id", message = "An agent's public id is its id." });
                }

                if (ApiCatalogService.ExposureProblem(agent) is { } problem)
                {
                    return BadRequest(new { error = "agent_not_exposable", message = problem });
                }
            }
            else
            {
                if (await _models.GetModelByIdAsync(dto.TargetId) == null)
                {
                    return BadRequest(new { error = "unknown_target", message = "Choose the model to expose." });
                }

                if (_agents.Find(publicId) != null)
                {
                    return BadRequest(new { error = "public_id_taken", message = $"The public id '{publicId}' is an agent's id." });
                }
            }

            var policy = ToolMapping.ToPolicy(new ToolAccessPolicyDto
            {
                Enabled = dto.Enabled,
                AllowedRoles = dto.AllowedRoles ?? [],
                AllowedGroupIds = dto.AllowedGroupIds ?? []
            });

            await _catalog.UpsertAsync(new ApiCatalogEntry
            {
                PublicId = publicId,
                Kind = dto.Kind,
                TargetId = dto.TargetId,
                Enabled = policy.Enabled,
                AllowedRoles = policy.AllowedRoles,
                AllowedGroupIds = policy.AllowedGroupIds,
                UpdatedAt = DateTime.UtcNow
            });

            return Ok(await BuildDtoAsync());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving API catalog entry {PublicId}", publicId);
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpDelete("{publicId}")]
    public async Task<ActionResult<ApiCatalogDto>> DeleteEntry(string publicId)
    {
        try
        {
            if (!await _catalog.DeleteAsync(publicId))
            {
                return NotFound($"API catalog entry {publicId} not found");
            }

            return Ok(await BuildDtoAsync());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting API catalog entry {PublicId}", publicId);
            return StatusCode(500, "Internal server error");
        }
    }

    private async Task<ApiCatalogDto> BuildDtoAsync() => new()
    {
        Entries = (await _catalog.GetEntriesAsync()).Select(entry => new ApiCatalogEntryDto
        {
            PublicId = entry.PublicId,
            Kind = entry.Kind,
            TargetId = entry.TargetId,
            Enabled = entry.Enabled,
            AllowedRoles = entry.AllowedRoles.ToList(),
            AllowedGroupIds = entry.AllowedGroupIds.ToList(),
            UpdatedAt = entry.UpdatedAt
        }).ToList(),
        Agents = _agents.Agents.Select(agent => new ApiCatalogAgentDto
        {
            Id = agent.Id,
            Name = agent.DisplayName,
            Description = agent.Description,
            ToolIds = agent.Functions.Select(f => f.Id).ToList(),
            DefaultPolicy = ToolMapping.ToDto(agent.DefaultPolicy)
        }).ToList(),
        Models = (await _models.GetAllModelsAsync())
            .OrderBy(model => model.ModelName, StringComparer.OrdinalIgnoreCase)
            .Select(model => new ApiCatalogModelDto
            {
                Id = model.Id,
                ModelName = model.ModelName,
                ModelId = model.ModelId
            }).ToList()
    };
}
