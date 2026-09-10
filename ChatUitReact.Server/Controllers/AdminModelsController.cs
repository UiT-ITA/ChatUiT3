using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services;
using ChatUitReact.Server.Services.TokenCounting;

namespace ChatUitReact.Server.Controllers;

[ApiController]
[Route("api/admin/models")]
[Authorize(Roles = "Admin")]
public class AdminModelsController : ControllerBase
{
    private readonly IModelService _modelService;

    public AdminModelsController(IModelService modelService)
    {
        _modelService = modelService;
    }

    [HttpGet]
    public async Task<ActionResult<List<ModelDto>>> GetModels()
    {
        try
        {
            var models = await _modelService.GetAllModelsAsync();
            return Ok(models.Select(ToDto).ToList());
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ModelDto>> GetModel(string id)
    {
        try
        {
            var model = await _modelService.GetModelByIdAsync(id);
            if (model == null)
            {
                return NotFound($"Model with id {id} not found");
            }

            return Ok(ToDto(model));
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }

    [HttpPost]
    public async Task<ActionResult<ModelDto>> CreateModel(CreateModelDto createDto)
    {
        try
        {
            if (!IsValidScheme(createDto.Capabilities.TokenCountingScheme))
            {
                return BadRequest($"Unknown token counting scheme '{createDto.Capabilities.TokenCountingScheme}'");
            }

            if (!Enum.TryParse<ApiProtocol>(createDto.ApiProtocol, ignoreCase: true, out var protocol))
            {
                return BadRequest($"Unknown API protocol '{createDto.ApiProtocol}'");
            }

            var model = new Model
            {
                ApiProtocol = protocol,
                ModelId = createDto.ModelId,
                ModelName = createDto.ModelName,
                Description = createDto.Description,
                EndpointId = createDto.EndpointId,
                AllowedRoles = createDto.AllowedRoles,
                AllowedAsDefault = createDto.AllowedAsDefault,
                Capabilities = ToCapabilities(createDto.Capabilities)
            };

            var createdId = await _modelService.CreateModelAsync(model);
            model.Id = createdId;

            return CreatedAtAction(nameof(GetModel), new { id = createdId }, ToDto(model));
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ModelDto>> UpdateModel(string id, UpdateModelDto updateDto)
    {
        try
        {
            if (id != updateDto.Id)
            {
                return BadRequest("Route id does not match request body id");
            }

            if (!IsValidScheme(updateDto.Capabilities.TokenCountingScheme))
            {
                return BadRequest($"Unknown token counting scheme '{updateDto.Capabilities.TokenCountingScheme}'");
            }

            if (!Enum.TryParse<ApiProtocol>(updateDto.ApiProtocol, ignoreCase: true, out var protocol))
            {
                return BadRequest($"Unknown API protocol '{updateDto.ApiProtocol}'");
            }

            var model = new Model
            {
                ApiProtocol = protocol,
                Id = updateDto.Id,
                ModelId = updateDto.ModelId,
                ModelName = updateDto.ModelName,
                Description = updateDto.Description,
                EndpointId = updateDto.EndpointId,
                AllowedRoles = updateDto.AllowedRoles,
                AllowedAsDefault = updateDto.AllowedAsDefault,
                Capabilities = ToCapabilities(updateDto.Capabilities)
            };

            var updated = await _modelService.UpdateModelAsync(model);
            if (!updated)
            {
                return NotFound($"Model with id {id} not found");
            }

            return Ok(ToDto(model));
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteModel(string id)
    {
        try
        {
            var deleted = await _modelService.DeleteModelAsync(id);
            if (!deleted)
            {
                return NotFound($"Model with id {id} not found");
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }

    private static ModelDto ToDto(Model model) => new()
    {
        Id = model.Id,
        ModelId = model.ModelId,
        ModelName = model.ModelName,
        Description = model.Description,
        EndpointId = model.EndpointId,
        AllowedRoles = model.AllowedRoles,
        AllowedAsDefault = model.AllowedAsDefault,
        ApiProtocol = model.ApiProtocol?.ToString() ?? string.Empty,
        Capabilities = new ModelCapabilitiesDto
        {
            SupportsVision = model.Capabilities.SupportsVision,
            SupportsFunctionCalling = model.Capabilities.SupportsFunctionCalling,
            Temperature = model.Capabilities.Temperature,
            SupportedEfforts = model.Capabilities.SupportedEfforts,
            MaxContextTokens = model.Capabilities.MaxContextTokens,
            MaxOutputTokens = model.Capabilities.MaxOutputTokens,
            DefaultMaxOutputTokens = model.Capabilities.DefaultMaxOutputTokens,
            KnowledgeCutoff = model.Capabilities.KnowledgeCutoff,
            TokenCountingScheme = model.Capabilities.TokenCountingScheme
        }
    };

    private static ModelCapabilities ToCapabilities(ModelCapabilitiesDto dto) => new()
    {
        SupportsVision = dto.SupportsVision,
        SupportsFunctionCalling = dto.SupportsFunctionCalling,
        Temperature = dto.Temperature,
        SupportedEfforts = NormalizeEfforts(dto.SupportedEfforts),
        MaxContextTokens = dto.MaxContextTokens,
        MaxOutputTokens = dto.MaxOutputTokens,
        // A model that never emits output is a misconfiguration, and Anthropic requires
        // max_tokens on every request — fall back to the ceiling rather than storing 0.
        DefaultMaxOutputTokens = dto.DefaultMaxOutputTokens > 0 ? dto.DefaultMaxOutputTokens : dto.MaxOutputTokens,
        KnowledgeCutoff = dto.KnowledgeCutoff,
        TokenCountingScheme = TokenCountingSchemes.Normalize(dto.TokenCountingScheme)
    };

    private static bool IsValidScheme(string? scheme) =>
        TokenCountingSchemes.Normalize(scheme) == null || TokenCountingSchemes.IsKnown(scheme);

    // Stored ascending and deduplicated so LowestEffort and the client's slider can both
    // rely on the order without re-sorting.
    private static List<ReasoningEffort> NormalizeEfforts(List<ReasoningEffort>? efforts) =>
        efforts == null ? new List<ReasoningEffort>() : efforts.Distinct().OrderBy(e => e).ToList();
}
