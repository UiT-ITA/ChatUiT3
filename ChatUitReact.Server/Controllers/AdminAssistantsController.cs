using ChatUitReact.Server.Models;
using ChatUitReact.Server.Models.DTOs;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace ChatUitReact.Server.Controllers
{
    [ApiController]
    [Route("api/admin/assistants")]
    [Authorize(Roles = "Admin")] // Restrict to admin role
    public class AdminAssistantsController : ControllerBase
    {
        private readonly DatabaseService _databaseService;
        private readonly UserService _userService;
        private readonly ILogger<AdminAssistantsController> _logger;
        private const string SystemOwner = "System";

        public AdminAssistantsController(
            DatabaseService databaseService,
            UserService userService,
            ILogger<AdminAssistantsController> logger)
        {
            _databaseService = databaseService;
            _userService = userService;
            _logger = logger;
        }

        // Helper method to convert AiAssistant to AssistantDto
        private AssistantDto ToAssistantDto(AiAssistant assistant)
        {
            var modelDto = new ModelDto
            {
                Id = assistant.Model.Id,
                Name = assistant.Model.Name,
                Description = assistant.Model.Description,
                ModelId = assistant.Model.ModelId,
                ModelType = assistant.Model.ModelType.ToString(),
                Endpoint = new EndpointDto
                {
                    Id = assistant.Model.Endpoint.Id,
                    Url = assistant.Model.Endpoint.Url
                },
                Capabilities = new ModelCapabilitiesDto
                {
                    SupportsVision = assistant.Model.Capabilities.SupportsVision,
                    SupportsReasoning = assistant.Model.Capabilities.SupportsReasoning,
                    SupportsFunctionCalling = assistant.Model.Capabilities.SupportsFunctionCalling,
                    SupportsCodeInterpreter = assistant.Model.Capabilities.SupportsCodeInterpreter,
                    MaxContextLength = assistant.Model.Capabilities.MaxContextLength,
                    MaxOutputLength = assistant.Model.Capabilities.MaxOutputLength
                }
            };

            return new AssistantDto
            {
                Id = assistant.Id,
                Name = assistant.Name,
                Description = assistant.Description,
                SystemPrompt = assistant.SystemPrompt,
                OwnerId = assistant.OwnerId,
                SharedWithUserIds = assistant.SharedWithUserIds,
                Model = modelDto,
                ModelSettings = assistant.ModelSettings,
                ToolIds = assistant.Tools.Select(t => t.Id).ToList(),
                PreloadedDocumentIds = assistant.PreloadedDocumentIds
            };
        }

        // Helper method to convert CreateAssistantDto to AiAssistant
        private async Task<AiAssistant> ToAiAssistantAsync(CreateAssistantDto dto)
        {
            var model = await _databaseService.GetModelAsync(dto.ModelId);
            if (model == null || string.IsNullOrEmpty(model.Id))
            {
                throw new ArgumentException($"Model with ID {dto.ModelId} not found");
            }

            var tools = new List<AiChatTool>();
            if (dto.ToolIds.Any())
            {
                foreach (var toolId in dto.ToolIds)
                {
                    var tool = await _databaseService.GetToolAsync(toolId);
                    if (tool != null && !string.IsNullOrEmpty(tool.Id))
                    {
                        tools.Add(tool);
                    }
                }
            }

            return new AiAssistant
            {
                Id = Guid.NewGuid().ToString(),
                Name = dto.Name,
                Description = dto.Description,
                SystemPrompt = dto.SystemPrompt,
                Model = model,
                ModelSettings = dto.ModelSettings,
                Tools = tools,
                OwnerId = SystemOwner, // Always set as System for admin-created assistants
                SharedWithUserIds = dto.SharedWithUserIds,
                PreloadedDocumentIds = dto.PreloadedDocumentIds,
                IsSystemCreated = true // Mark as system created
            };
        }

        // Helper method to update AiAssistant from UpdateAssistantDto
        private async Task UpdateAiAssistantAsync(AiAssistant assistant, UpdateAssistantDto dto)
        {
            var model = await _databaseService.GetModelAsync(dto.ModelId);
            if (model == null || string.IsNullOrEmpty(model.Id))
            {
                throw new ArgumentException($"Model with ID {dto.ModelId} not found");
            }

            var tools = new List<AiChatTool>();
            if (dto.ToolIds.Any())
            {
                foreach (var toolId in dto.ToolIds)
                {
                    var tool = await _databaseService.GetToolAsync(toolId);
                    if (tool != null && !string.IsNullOrEmpty(tool.Id))
                    {
                        tools.Add(tool);
                    }
                }
            }

            assistant.Name = dto.Name;
            assistant.Description = dto.Description;
            assistant.SystemPrompt = dto.SystemPrompt;
            assistant.Model = model;
            assistant.ModelSettings = dto.ModelSettings;
            assistant.Tools = tools;
            assistant.SharedWithUserIds = dto.SharedWithUserIds;
            assistant.PreloadedDocumentIds = dto.PreloadedDocumentIds;
            // We don't change the OwnerId or IsSystemCreated as these should remain constant
        }

        // GET: api/admin/assistants
        [HttpGet]
        public async Task<ActionResult<List<AssistantDto>>> GetAllSystemAssistants()
        {
            try
            {
                // Get all assistants from database
                var allAssistants = await _databaseService.GetAllAssistantsAsync();
                
                // Filter to only include system-owned assistants
                var systemAssistants = allAssistants
                    .Where(a => a.OwnerId == SystemOwner)
                    .ToList();
                
                var assistantDtos = systemAssistants.Select(a => ToAssistantDto(a)).ToList();
                return Ok(assistantDtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving system assistants");
                return StatusCode(500, "An error occurred while retrieving system assistants");
            }
        }

        // GET: api/admin/assistants/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<AssistantDto>> GetAssistant(string id)
        {
            try
            {
                var assistant = await _databaseService.GetAssistantAsync(id);
                if (assistant == null || string.IsNullOrEmpty(assistant.Id))
                {
                    return NotFound($"Assistant with ID {id} not found");
                }
                
                // Check that this is a system assistant
                if (assistant.OwnerId != SystemOwner)
                {
                    return BadRequest("This API endpoint can only access system-owned assistants");
                }
                
                return Ok(ToAssistantDto(assistant));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving assistant {AssistantId}", id);
                return StatusCode(500, "An error occurred while retrieving the assistant");
            }
        }

        // POST: api/admin/assistants
        [HttpPost]
        public async Task<ActionResult<AssistantDto>> CreateAssistant(CreateAssistantDto createDto)
        {
            try
            {
                if (createDto == null)
                {
                    return BadRequest("Assistant data is required");
                }

                // Validate the assistant request

                // Validate required fields
                if (string.IsNullOrWhiteSpace(createDto.Name))
                {
                    return BadRequest("Assistant name is required");
                }

                if (string.IsNullOrWhiteSpace(createDto.ModelId))
                {
                    return BadRequest("Model ID is required");
                }

                // Convert DTO to domain model
                try
                {
                    var assistant = await ToAiAssistantAsync(createDto);
                    var createdAssistant = await _databaseService.CreateAssistantAsync(assistant, SystemOwner);
                    
                    // Return the created assistant as a DTO
                    return CreatedAtAction(nameof(GetAssistant), new { id = createdAssistant.Id }, ToAssistantDto(createdAssistant));
                }
                catch (ArgumentException ex)
                {
                    return BadRequest(ex.Message);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating assistant: {ErrorMessage}", ex.Message);
                return StatusCode(500, $"An error occurred while creating the assistant: {ex.Message}");
            }
        }

        // PUT: api/admin/assistants/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateAssistant(string id, UpdateAssistantDto updateDto)
        {
            try
            {
                if (updateDto == null)
                {
                    return BadRequest("Assistant data is required");
                }

                if (id != updateDto.Id)
                {
                    return BadRequest("Assistant ID mismatch");
                }

                var existingAssistant = await _databaseService.GetAssistantAsync(id);
                if (existingAssistant == null || string.IsNullOrEmpty(existingAssistant.Id))
                {
                    return NotFound($"Assistant with ID {id} not found");
                }

                // Check that this is a system assistant
                if (existingAssistant.OwnerId != SystemOwner)
                {
                    return BadRequest("This API endpoint can only update system-owned assistants");
                }

                // Update the existing assistant with DTO data
                try
                {
                    await UpdateAiAssistantAsync(existingAssistant, updateDto);
                    await _databaseService.UpdateAssistantAsync(existingAssistant);
                    return NoContent();
                }
                catch (ArgumentException ex)
                {
                    return BadRequest(ex.Message);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating assistant {AssistantId}: {ErrorMessage}", id, ex.Message);
                return StatusCode(500, $"An error occurred while updating the assistant: {ex.Message}");
            }
        }

        // DELETE: api/admin/assistants/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAssistant(string id)
        {
            try
            {
                var assistant = await _databaseService.GetAssistantAsync(id);
                if (assistant == null || string.IsNullOrEmpty(assistant.Id))
                {
                    return NotFound($"Assistant with ID {id} not found");
                }

                // Check that this is a system assistant
                if (assistant.OwnerId != SystemOwner)
                {
                    return BadRequest("This API endpoint can only delete system-owned assistants");
                }

                // Check if the assistant is being used by any chats before deleting
                // This would require checking all user chats, which might be too extensive
                // Consider a soft delete approach if this becomes necessary

                await _databaseService.DeleteAssistantAsync(id, SystemOwner);
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting assistant {AssistantId}: {ErrorMessage}", id, ex.Message);
                return StatusCode(500, $"An error occurred while deleting the assistant: {ex.Message}");
            }
        }
    }
}
