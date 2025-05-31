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
                ModelName = m.ModelName,
                EndpointId = m.EndpointId,
                AllowedRoles = m.AllowedRoles
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
                ModelName = model.ModelName,
                EndpointId = model.EndpointId,
                AllowedRoles = model.AllowedRoles
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
                ModelName = createDto.ModelName,
                EndpointId = createDto.EndpointId,
                AllowedRoles = createDto.AllowedRoles
            };

            var createdId = await _modelService.CreateModelAsync(model);
            model.Id = createdId;

            var modelDto = new ModelDto
            {
                Id = model.Id,
                ModelName = model.ModelName,
                EndpointId = model.EndpointId,
                AllowedRoles = model.AllowedRoles
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
                ModelName = updateDto.ModelName,
                EndpointId = updateDto.EndpointId,
                AllowedRoles = updateDto.AllowedRoles
            };

            var updated = await _modelService.UpdateModelAsync(model);
            if (!updated)
            {
                return NotFound($"Model with id {id} not found");
            }

            var modelDto = new ModelDto
            {
                Id = model.Id,
                ModelName = model.ModelName,
                EndpointId = model.EndpointId,
                AllowedRoles = model.AllowedRoles
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
