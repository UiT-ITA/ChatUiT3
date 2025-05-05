using ChatUitReact.Server.Models;
using ChatUitReact.Server.Models.DTOs;
using ChatUitReact.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUitReact.Server.Controllers
{
    [ApiController]
    [Route("api/admin/endpoints")]
    [Authorize(Roles = "Admin")] // Restrict to admin role
    public class AdminEndpointsController : ControllerBase
    {
        private readonly DatabaseService _databaseService;
        private readonly UserService _userService;
        private readonly ILogger<AdminEndpointsController> _logger;

        public AdminEndpointsController(
            DatabaseService databaseService,
            UserService userService,
            ILogger<AdminEndpointsController> logger)
        {
            _databaseService = databaseService;
            _userService = userService;
            _logger = logger;
        }

        // Helper method to convert AiModelEndpoint to EndpointDto
        private EndpointDto ToEndpointDto(AiModelEndpoint endpoint)
        {
            return new EndpointDto
            {
                Id = endpoint.Id,
                Url = endpoint.Url
                // API key is not included in the response for security
            };
        }
        
        // Helper method to convert CreateEndpointDto to AiModelEndpoint
        private AiModelEndpoint ToAiModelEndpoint(CreateEndpointDto dto)
        {
            return new AiModelEndpoint
            {
                Id = Guid.NewGuid().ToString(),
                Url = dto.Url,
                ApiKey = dto.ApiKey
            };
        }
        
        // Helper method to update AiModelEndpoint from UpdateEndpointDto
        private void UpdateAiModelEndpoint(AiModelEndpoint endpoint, UpdateEndpointDto dto)
        {
            endpoint.Url = dto.Url;
            endpoint.ApiKey = dto.ApiKey;
        }

        // GET: api/admin/endpoints
        [HttpGet]
        public async Task<ActionResult<List<EndpointDto>>> GetAllEndpoints()
        {
            try
            {
                // Get all endpoints from database
                var endpoints = await _databaseService.GetEndpointsAsync();
                var endpointDtos = endpoints.Select(e => ToEndpointDto(e)).ToList();
                return Ok(endpointDtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving endpoints");
                return StatusCode(500, "An error occurred while retrieving endpoints");
            }
        }

        // GET: api/admin/endpoints/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<EndpointDto>> GetEndpoint(string id)
        {
            try
            {
                var endpoint = await _databaseService.GetEndpointAsync(id);
                if (endpoint == null || string.IsNullOrEmpty(endpoint.Id))
                {
                    return NotFound($"Endpoint with ID {id} not found");
                }
                return Ok(ToEndpointDto(endpoint));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving endpoint {EndpointId}", id);
                return StatusCode(500, "An error occurred while retrieving the endpoint");
            }
        }

        // POST: api/admin/endpoints
        [HttpPost]
        public async Task<ActionResult<EndpointDto>> CreateEndpoint(CreateEndpointDto createDto)
        {
            try
            {
                if (createDto == null)
                {
                    return BadRequest("Endpoint data is required");
                }

                // Convert DTO to domain model
                var endpoint = ToAiModelEndpoint(createDto);
                
                _logger.LogInformation("Creating endpoint with URL: {Url}", endpoint.Url);
                await _databaseService.CreateEndpointAsync(endpoint);
                
                // Return the created endpoint as a DTO
                return CreatedAtAction(nameof(GetEndpoint), new { id = endpoint.Id }, ToEndpointDto(endpoint));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating endpoint: {ErrorMessage}", ex.Message);
                return StatusCode(500, $"An error occurred while creating the endpoint: {ex.Message}");
            }
        }

        // PUT: api/admin/endpoints/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateEndpoint(string id, UpdateEndpointDto updateDto)
        {
            try
            {
                if (updateDto == null)
                {
                    return BadRequest("Endpoint data is required");
                }

                if (id != updateDto.Id)
                {
                    return BadRequest("Endpoint ID mismatch");
                }

                var existingEndpoint = await _databaseService.GetEndpointAsync(id);
                if (existingEndpoint == null || string.IsNullOrEmpty(existingEndpoint.Id))
                {
                    return NotFound($"Endpoint with ID {id} not found");
                }

                // Update the existing endpoint with DTO data
                UpdateAiModelEndpoint(existingEndpoint, updateDto);
                await _databaseService.UpdateEndpointAsync(existingEndpoint);
                
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating endpoint {EndpointId}: {ErrorMessage}", id, ex.Message);
                return StatusCode(500, $"An error occurred while updating the endpoint: {ex.Message}");
            }
        }

        // DELETE: api/admin/endpoints/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteEndpoint(string id)
        {
            try
            {
                var endpoint = await _databaseService.GetEndpointAsync(id);
                if (endpoint == null || string.IsNullOrEmpty(endpoint.Id))
                {
                    return NotFound($"Endpoint with ID {id} not found");
                }

                // Check if the endpoint is being used by any models before deleting
                var models = await _databaseService.GetModelsAsync();
                var usedByModels = models.Where(m => m.Endpoint.Id == id).ToList();
                
                if (usedByModels.Any())
                {
                    var modelNames = string.Join(", ", usedByModels.Select(m => m.Name));
                    return BadRequest($"Cannot delete endpoint because it is used by the following models: {modelNames}");
                }

                await _databaseService.DeleteEndpointAsync(id);
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting endpoint {EndpointId}: {ErrorMessage}", id, ex.Message);
                return StatusCode(500, $"An error occurred while deleting the endpoint: {ex.Message}");
            }
        }
    }
}
