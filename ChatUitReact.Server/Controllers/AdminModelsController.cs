using Microsoft.AspNetCore.Mvc;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services;

namespace ChatUitReact.Server.Controllers;

[ApiController]
[Route("api/admin/models")]
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
            var modelDtos = models.Select(m => new ModelDto
            {
                Id = m.Id,
                ModelId = m.ModelId,
                ModelName = m.ModelName,
                Description = m.Description,
                EndpointId = m.EndpointId,
                AllowedRoles = m.AllowedRoles,
                Capabilities = new ModelCapabilitiesDto
                {
                    SupportsVision = m.Capabilities.SupportsVision,
                    SupportsReasoning = m.Capabilities.SupportsReasoning,
                    SupportsFunctionCalling = m.Capabilities.SupportsFunctionCalling,
                    SupportsTemperature = m.Capabilities.SupportsTemperature,
                    MaxContextLength = m.Capabilities.MaxContextLength,
                    MaxOutputLength = m.Capabilities.MaxOutputLength,
                    KnowledgeCutoff = m.Capabilities.KnowledgeCutoff
                }
            }).ToList();

            return Ok(modelDtos);
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

            var modelDto = new ModelDto
            {
                Id = model.Id,
                ModelId = model.ModelId,
                ModelName = model.ModelName,
                Description = model.Description,
                EndpointId = model.EndpointId,
                AllowedRoles = model.AllowedRoles,
                Capabilities = new ModelCapabilitiesDto
                {
                    SupportsVision = model.Capabilities.SupportsVision,
                    SupportsReasoning = model.Capabilities.SupportsReasoning,
                    SupportsFunctionCalling = model.Capabilities.SupportsFunctionCalling,
                    SupportsTemperature = model.Capabilities.SupportsTemperature,
                    MaxContextLength = model.Capabilities.MaxContextLength,
                    MaxOutputLength = model.Capabilities.MaxOutputLength,
                    KnowledgeCutoff = model.Capabilities.KnowledgeCutoff
                }
            };

            return Ok(modelDto);
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
            var model = new Model
            {
                ModelId = createDto.ModelId,
                ModelName = createDto.ModelName,
                Description = createDto.Description,
                EndpointId = createDto.EndpointId,
                AllowedRoles = createDto.AllowedRoles,
                Capabilities = new ModelCapabilities
                {
                    SupportsVision = createDto.Capabilities.SupportsVision,
                    SupportsReasoning = createDto.Capabilities.SupportsReasoning,
                    SupportsFunctionCalling = createDto.Capabilities.SupportsFunctionCalling,
                    SupportsTemperature = createDto.Capabilities.SupportsTemperature,
                    MaxContextLength = createDto.Capabilities.MaxContextLength,
                    MaxOutputLength = createDto.Capabilities.MaxOutputLength,
                    KnowledgeCutoff = createDto.Capabilities.KnowledgeCutoff
                }
            };

            var createdId = await _modelService.CreateModelAsync(model);
            model.Id = createdId;

            var modelDto = new ModelDto
            {
                Id = model.Id,
                ModelId = model.ModelId,
                ModelName = model.ModelName,
                Description = model.Description,
                EndpointId = model.EndpointId,
                AllowedRoles = model.AllowedRoles,
                Capabilities = new ModelCapabilitiesDto
                {
                    SupportsVision = model.Capabilities.SupportsVision,
                    SupportsReasoning = model.Capabilities.SupportsReasoning,
                    SupportsFunctionCalling = model.Capabilities.SupportsFunctionCalling,
                    SupportsTemperature = model.Capabilities.SupportsTemperature,
                    MaxContextLength = model.Capabilities.MaxContextLength,
                    MaxOutputLength = model.Capabilities.MaxOutputLength,
                    KnowledgeCutoff = model.Capabilities.KnowledgeCutoff
                }
            };

            return CreatedAtAction(nameof(GetModel), new { id = createdId }, modelDto);
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

            var model = new Model
            {
                Id = updateDto.Id,
                ModelId = updateDto.ModelId,
                ModelName = updateDto.ModelName,
                Description = updateDto.Description,
                EndpointId = updateDto.EndpointId,
                AllowedRoles = updateDto.AllowedRoles,
                Capabilities = new ModelCapabilities
                {
                    SupportsVision = updateDto.Capabilities.SupportsVision,
                    SupportsReasoning = updateDto.Capabilities.SupportsReasoning,
                    SupportsFunctionCalling = updateDto.Capabilities.SupportsFunctionCalling,
                    SupportsTemperature = updateDto.Capabilities.SupportsTemperature,
                    MaxContextLength = updateDto.Capabilities.MaxContextLength,
                    MaxOutputLength = updateDto.Capabilities.MaxOutputLength,
                    KnowledgeCutoff = updateDto.Capabilities.KnowledgeCutoff
                }
            };

            var updated = await _modelService.UpdateModelAsync(model);
            if (!updated)
            {
                return NotFound($"Model with id {id} not found");
            }

            var modelDto = new ModelDto
            {
                Id = model.Id,
                ModelId = model.ModelId,
                ModelName = model.ModelName,
                Description = model.Description,
                EndpointId = model.EndpointId,
                AllowedRoles = model.AllowedRoles,
                Capabilities = new ModelCapabilitiesDto
                {
                    SupportsVision = model.Capabilities.SupportsVision,
                    SupportsReasoning = model.Capabilities.SupportsReasoning,
                    SupportsFunctionCalling = model.Capabilities.SupportsFunctionCalling,
                    SupportsTemperature = model.Capabilities.SupportsTemperature,
                    MaxContextLength = model.Capabilities.MaxContextLength,
                    MaxOutputLength = model.Capabilities.MaxOutputLength,
                    KnowledgeCutoff = model.Capabilities.KnowledgeCutoff
                }
            };

            return Ok(modelDto);
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
}
