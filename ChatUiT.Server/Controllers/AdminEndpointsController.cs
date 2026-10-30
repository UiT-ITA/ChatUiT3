using System.Net.Http.Headers;
using System.Text.Json;
using Azure.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services;
using ChatUiT.Server.Services.AiProviders.Protocols;

namespace ChatUiT.Server.Controllers;

// Endpoints carry provider API keys, so this must never be reachable unauthenticated.
[ApiController]
[Route("api/admin/endpoints")]
[Authorize(Roles = "Admin")]
public class AdminEndpointsController : ControllerBase
{
    private readonly IModelService _modelService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<AdminEndpointsController> _logger;
    private readonly TokenCredential _credential;

    public AdminEndpointsController(IModelService modelService, IHttpClientFactory httpClientFactory, ILogger<AdminEndpointsController> logger, TokenCredential credential)
    {
        _modelService = modelService;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _credential = credential;
    }

    private static EndpointDto ToDto(ModelEndpoint endpoint) => new()
    {
        Id = endpoint.Id,
        Url = endpoint.Url,
        EndpointType = endpoint.EndpointType.ToString(),
        AuthMethod = endpoint.AuthMethod.ToString()
    };

    /// <summary>Parses the auth method; blank means <paramref name="blankMeans"/>. Returns an error message when it is invalid or the endpoint type does not accept it.</summary>
    private static string? TryParseAuthMethod(string value, EndpointType endpointType, EndpointAuthMethod blankMeans, out EndpointAuthMethod authMethod)
    {
        authMethod = blankMeans;
        if (!string.IsNullOrWhiteSpace(value) && !Enum.TryParse(value, out authMethod))
        {
            return $"Invalid auth method: {value}";
        }

        if (authMethod == EndpointAuthMethod.ManagedIdentity && !ModelEndpoint.SupportsManagedIdentity(endpointType))
        {
            return $"A {endpointType} endpoint does not accept managed identity. Use an API key.";
        }

        return null;
    }

    [HttpGet]
    public async Task<ActionResult<List<EndpointDto>>> GetEndpoints()
    {
        try
        {
            var endpoints = await _modelService.GetAllEndpointsAsync();
            var endpointDtos = endpoints.Select(ToDto).ToList();

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

            return Ok(ToDto(endpoint));
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }

    /// <summary>
    /// The endpoint's deployments, without failed ones. Returns an empty list when the endpoint type
    /// is not supported or the call fails.
    /// </summary>
    [HttpGet("{id}/deployments")]
    public async Task<ActionResult<List<EndpointDeploymentDto>>> GetDeployments(string id, CancellationToken ct)
    {
        var endpoint = await _modelService.GetEndpointByIdAsync(id);
        if (endpoint == null)
        {
            return NotFound($"Endpoint with id {id} not found");
        }

        if (endpoint.EndpointType != EndpointType.MicrosoftFoundry
            || !Uri.TryCreate(endpoint.Url, UriKind.Absolute, out var endpointUri))
        {
            return Ok(new List<EndpointDeploymentDto>());
        }

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(10));
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get,
                endpointUri.GetLeftPart(UriPartial.Authority) + "/openai/deployments?api-version=2022-12-01");
            if (endpoint.AuthMethod == EndpointAuthMethod.ManagedIdentity)
            {
                var token = await _credential.GetTokenAsync(new TokenRequestContext([AzureAiAuth.Scope]), timeout.Token);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);
            }
            else
            {
                request.Headers.Add("api-key", endpoint.ApiKey);
            }
            using var response = await _httpClientFactory.CreateClient().SendAsync(request, timeout.Token);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Listing deployments for endpoint {EndpointId} returned {StatusCode}", id, (int)response.StatusCode);
                return Ok(new List<EndpointDeploymentDto>());
            }

            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(timeout.Token));
            var deployments = new List<EndpointDeploymentDto>();
            if (document.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    var name = item.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;
                    var model = item.TryGetProperty("model", out var modelProp) ? modelProp.GetString() : null;
                    var status = item.TryGetProperty("status", out var statusProp) ? statusProp.GetString() : null;
                    if (string.IsNullOrEmpty(name) || string.Equals(status, "failed", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                    deployments.Add(new EndpointDeploymentDto { Name = name, Model = model ?? string.Empty });
                }
            }

            return Ok(deployments.OrderBy(d => d.Name, StringComparer.OrdinalIgnoreCase).ToList());
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or Azure.Identity.AuthenticationFailedException or InvalidOperationException or OperationCanceledException && !ct.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Listing deployments for endpoint {EndpointId} failed", id);
            return Ok(new List<EndpointDeploymentDto>());
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

            var authError = TryParseAuthMethod(createDto.AuthMethod, endpointType, EndpointAuthMethod.ApiKey, out var authMethod);
            if (authError != null)
            {
                return BadRequest(authError);
            }

            if (authMethod == EndpointAuthMethod.ApiKey && string.IsNullOrWhiteSpace(createDto.ApiKey))
            {
                return BadRequest("An API key is required.");
            }

            var endpoint = new ModelEndpoint
            {
                Url = createDto.Url,
                ApiKey = authMethod == EndpointAuthMethod.ApiKey ? createDto.ApiKey : string.Empty,
                EndpointType = endpointType,
                AuthMethod = authMethod
            };

            var createdId = await _modelService.CreateEndpointAsync(endpoint);
            endpoint.Id = createdId;

            return CreatedAtAction(nameof(GetEndpoint), new { id = createdId }, ToDto(endpoint));
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

            var existing = await _modelService.GetEndpointByIdAsync(updateDto.Id);
            if (existing == null)
            {
                return NotFound($"Endpoint with id {id} not found");
            }

            var authError = TryParseAuthMethod(updateDto.AuthMethod, endpointType, existing.AuthMethod, out var authMethod);
            if (authError != null)
            {
                return BadRequest(authError);
            }

            // An empty api key means "leave the existing key alone". Managed identity stores no key.
            var apiKey = authMethod == EndpointAuthMethod.ManagedIdentity
                ? string.Empty
                : string.IsNullOrWhiteSpace(updateDto.ApiKey) ? existing.ApiKey : updateDto.ApiKey;
            if (authMethod == EndpointAuthMethod.ApiKey && string.IsNullOrWhiteSpace(apiKey))
            {
                return BadRequest("An API key is required.");
            }

            var endpoint = new ModelEndpoint
            {
                Id = updateDto.Id,
                Url = updateDto.Url,
                ApiKey = apiKey,
                EndpointType = endpointType,
                AuthMethod = authMethod
            };

            var updated = await _modelService.UpdateEndpointAsync(endpoint);
            if (!updated)
            {
                return NotFound($"Endpoint with id {id} not found");
            }

            return Ok(ToDto(endpoint));
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
