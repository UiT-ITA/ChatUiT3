using ChatUitReact.Server.Models;
using ChatUitReact.Server.Models.DTOs;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace ChatUitReact.Server.Controllers
{
    [ApiController]
    [Route("api/admin/models")]
    [Authorize(Roles = "Admin")] // Restrict to admin role
    public class AdminModelsController : ControllerBase
    {
        private readonly DatabaseService _databaseService;
        private readonly UserService _userService;
        private readonly ILogger<AdminModelsController> _logger;

        public AdminModelsController(
            DatabaseService databaseService,
            UserService userService,
            ILogger<AdminModelsController> logger)
        {
            _databaseService = databaseService;
            _userService = userService;
            _logger = logger;
        }

        // Helper method to convert AiModel to ModelDto
        private ModelDto ToModelDto(AiModel model)
        {
            return new ModelDto
            {
                Id = model.Id,
                Name = model.Name,
                Description = model.Description,
                ModelId = model.ModelId,
                ModelType = model.ModelType.ToString(),
                Endpoint = new EndpointDto
                {
                    Id = model.Endpoint.Id,
                    Url = model.Endpoint.Url
                },
                Capabilities = new ModelCapabilitiesDto
                {
                    SupportsVision = model.Capabilities.SupportsVision,
                    SupportsReasoning = model.Capabilities.SupportsReasoning,
                    SupportsFunctionCalling = model.Capabilities.SupportsFunctionCalling,
                    SupportsCodeInterpreter = model.Capabilities.SupportsCodeInterpreter,
                    MaxContextLength = model.Capabilities.MaxContextLength,
                    MaxOutputLength = model.Capabilities.MaxOutputLength
                }
            };
        }

        // Helper method to convert CreateModelDto to AiModel
        private async Task<AiModel> ToAiModelAsync(CreateModelDto dto)
        {
            var endpoint = await _databaseService.GetEndpointAsync(dto.EndpointId);
            if (endpoint == null || string.IsNullOrEmpty(endpoint.Id))
            {
                throw new ArgumentException($"Endpoint with ID {dto.EndpointId} not found");
            }

            return new AiModel
            {
                Id = Guid.NewGuid().ToString(),
                Name = dto.Name,
                Description = dto.Description,
                ModelId = dto.ModelId,
                ModelType = Enum.Parse<AiModelType>(dto.ModelType),
                Endpoint = endpoint,
                Capabilities = new AiModelCapabilities
                {
                    SupportsVision = dto.Capabilities.SupportsVision,
                    SupportsReasoning = dto.Capabilities.SupportsReasoning,
                    SupportsFunctionCalling = dto.Capabilities.SupportsFunctionCalling,
                    SupportsCodeInterpreter = dto.Capabilities.SupportsCodeInterpreter,
                    MaxContextLength = dto.Capabilities.MaxContextLength,
                    MaxOutputLength = dto.Capabilities.MaxOutputLength
                }
            };
        }

        // Helper method to update AiModel from UpdateModelDto
        private async Task UpdateAiModelAsync(AiModel model, UpdateModelDto dto)
        {
            var endpoint = await _databaseService.GetEndpointAsync(dto.EndpointId);
            if (endpoint == null || string.IsNullOrEmpty(endpoint.Id))
            {
                throw new ArgumentException($"Endpoint with ID {dto.EndpointId} not found");
            }

            model.Name = dto.Name;
            model.Description = dto.Description;
            model.ModelId = dto.ModelId;
            model.ModelType = Enum.Parse<AiModelType>(dto.ModelType);
            model.Endpoint = endpoint;
            model.Capabilities.SupportsVision = dto.Capabilities.SupportsVision;
            model.Capabilities.SupportsReasoning = dto.Capabilities.SupportsReasoning;
            model.Capabilities.SupportsFunctionCalling = dto.Capabilities.SupportsFunctionCalling;
            model.Capabilities.SupportsCodeInterpreter = dto.Capabilities.SupportsCodeInterpreter;
            model.Capabilities.MaxContextLength = dto.Capabilities.MaxContextLength;
            model.Capabilities.MaxOutputLength = dto.Capabilities.MaxOutputLength;
        }

        // GET: api/admin/models
        [HttpGet]
        public async Task<ActionResult<List<ModelDto>>> GetAllModels()
        {
            try
            {
                var models = await _databaseService.GetModelsAsync();
                var modelDtos = models.Select(m => ToModelDto(m)).ToList();
                return Ok(modelDtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving models");
                return StatusCode(500, "An error occurred while retrieving models");
            }
        }

        // GET: api/admin/models/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<ModelDto>> GetModel(string id)
        {
            try
            {
                var model = await _databaseService.GetModelAsync(id);
                if (model == null || string.IsNullOrEmpty(model.Id))
                {
                    return NotFound($"Model with ID {id} not found");
                }
                return Ok(ToModelDto(model));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving model {ModelId}", id);
                return StatusCode(500, "An error occurred while retrieving the model");
            }
        }

        // POST: api/admin/models
        [HttpPost]
        public async Task<ActionResult<ModelDto>> CreateModel(CreateModelDto createDto)
        {
            try
            {
                if (createDto == null)
                {
                    return BadRequest("Model data is required");
                }

                // Validate the model data

                // Validate required fields
                if (string.IsNullOrWhiteSpace(createDto.Name))
                {
                    return BadRequest("Model name is required");
                }

                if (string.IsNullOrWhiteSpace(createDto.ModelId))
                {
                    return BadRequest("Model ID is required");
                }

                if (string.IsNullOrWhiteSpace(createDto.EndpointId))
                {
                    return BadRequest("Endpoint ID is required");
                }

                // Convert DTO to domain model
                try
                {
                    var model = await ToAiModelAsync(createDto);
                    var createdModel = await _databaseService.CreateModelAsync(model);
                    
                    // Return the created model as a DTO
                    return CreatedAtAction(nameof(GetModel), new { id = createdModel.Id }, ToModelDto(createdModel));
                }
                catch (ArgumentException ex)
                {
                    return BadRequest(ex.Message);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating model: {ErrorMessage}", ex.Message);
                return StatusCode(500, $"An error occurred while creating the model: {ex.Message}");
            }
        }

        // PUT: api/admin/models/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateModel(string id, UpdateModelDto updateDto)
        {
            try
            {
                if (updateDto == null)
                {
                    return BadRequest("Model data is required");
                }

                if (id != updateDto.Id)
                {
                    return BadRequest("Model ID mismatch");
                }

                var existingModel = await _databaseService.GetModelAsync(id);
                if (existingModel == null || string.IsNullOrEmpty(existingModel.Id))
                {
                    return NotFound($"Model with ID {id} not found");
                }

                // Update the existing model with DTO data
                try
                {
                    await UpdateAiModelAsync(existingModel, updateDto);
                    await _databaseService.UpdateModelAsync(existingModel);
                    return NoContent();
                }
                catch (ArgumentException ex)
                {
                    return BadRequest(ex.Message);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating model {ModelId}: {ErrorMessage}", id, ex.Message);
                return StatusCode(500, $"An error occurred while updating the model: {ex.Message}");
            }
        }

        // DELETE: api/admin/models/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteModel(string id)
        {
            try
            {
                var model = await _databaseService.GetModelAsync(id);
                if (model == null || string.IsNullOrEmpty(model.Id))
                {
                    return NotFound($"Model with ID {id} not found");
                }

                // Check if the model is being used by any assistants before deleting
                var assistants = await _databaseService.GetAllAssistantsAsync();
                var usedByAssistants = assistants.Where(a => a.Model.Id == id).ToList();
                
                if (usedByAssistants.Any())
                {
                    var assistantNames = string.Join(", ", usedByAssistants.Select(a => a.Name));
                    return BadRequest($"Cannot delete model because it is used by the following assistants: {assistantNames}");
                }

                await _databaseService.DeleteModelAsync(id);
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting model {ModelId}: {ErrorMessage}", id, ex.Message);
                return StatusCode(500, $"An error occurred while deleting the model: {ex.Message}");
            }
        }
    }
}
