using Microsoft.AspNetCore.Mvc;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services;

namespace ChatUitReact.Server.Controllers;

[ApiController]
[Route("api/admin/endpoints")]
public class AdminEndpointsController : ControllerBase
{
    private readonly IModelService _modelService;

    public AdminEndpointsController(IModelService modelService)
    {
        _modelService = modelService;
    }

    [HttpGet]
    public async Task<ActionResult<List<EndpointDto>>> GetEndpoints()
    {
        try
        {
            var endpoints = await _modelService.GetAllEndpointsAsync();
            var endpointDtos = endpoints.Select(e => new EndpointDto
            {
                Id = e.Id,
                Url = e.Url,
                EndpointType = e.EndpointType.ToString()
            }).ToList();

            return Ok(endpointDtos);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<EndpointDto>> GetEndpoint(string id)
    {
        try
        {
            var endpoint = await _modelService.GetEndpointByIdAsync(id);
            if (endpoint == null)
            {
                return NotFound($"Endpoint with id {id} not found");
            }

            var endpointDto = new EndpointDto
            {
                Id = endpoint.Id,
                Url = endpoint.Url,
                EndpointType = endpoint.EndpointType.ToString()
            };

            return Ok(endpointDto);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }

    [HttpPost]
    public async Task<ActionResult<EndpointDto>> CreateEndpoint(CreateEndpointDto createDto)
    {
        try
        {
            if (!Enum.TryParse<EndpointType>(createDto.EndpointType, out var endpointType))
            {
                return BadRequest($"Invalid endpoint type: {createDto.EndpointType}");
            }

            var endpoint = new ModelEndpoint
            {
                Url = createDto.Url,
                ApiKey = createDto.ApiKey,
                EndpointType = endpointType
            };

            var createdId = await _modelService.CreateEndpointAsync(endpoint);
            endpoint.Id = createdId;

            var endpointDto = new EndpointDto
            {
                Id = endpoint.Id,
                Url = endpoint.Url,
                EndpointType = endpoint.EndpointType.ToString()
            };

            return CreatedAtAction(nameof(GetEndpoint), new { id = createdId }, endpointDto);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<EndpointDto>> UpdateEndpoint(string id, UpdateEndpointDto updateDto)
    {
        try
        {
            if (id != updateDto.Id)
            {
                return BadRequest("Route id does not match request body id");
            }

            if (!Enum.TryParse<EndpointType>(updateDto.EndpointType, out var endpointType))
            {
                return BadRequest($"Invalid endpoint type: {updateDto.EndpointType}");
            }

            var endpoint = new ModelEndpoint
            {
                Id = updateDto.Id,
                Url = updateDto.Url,
                ApiKey = updateDto.ApiKey,
                EndpointType = endpointType
            };

            var updated = await _modelService.UpdateEndpointAsync(endpoint);
            if (!updated)
            {
                return NotFound($"Endpoint with id {id} not found");
            }

            var endpointDto = new EndpointDto
            {
                Id = endpoint.Id,
                Url = endpoint.Url,
                EndpointType = endpoint.EndpointType.ToString()
            };

            return Ok(endpointDto);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteEndpoint(string id)
    {
        try
        {
            var deleted = await _modelService.DeleteEndpointAsync(id);
            if (!deleted)
            {
                return NotFound($"Endpoint with id {id} not found");
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }
}
