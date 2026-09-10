using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Catalog;

namespace ChatUitReact.Server.Controllers;

/// <summary>
/// Capability defaults for known models, so the admin form can prefill instead of asking
/// someone to remember whether gpt-5.4 accepts a temperature.
/// </summary>
[ApiController]
[Route("api/admin/model-catalog")]
[Authorize(Roles = "Admin")]
public class AdminModelCatalogController : ControllerBase
{
    [HttpGet]
    public ActionResult<List<CatalogModelDto>> GetCatalog()
    {
        var entries = ModelCatalog.All.Select(entry => new CatalogModelDto
        {
            ModelId = entry.ModelId,
            DisplayName = entry.DisplayName,
            Description = entry.Description,
            Provider = entry.Provider.ToString(),
            ApiProtocol = entry.ApiProtocol.ToString(),
            Capabilities = new ModelCapabilitiesDto
            {
                SupportsVision = entry.Capabilities.SupportsVision,
                SupportsFunctionCalling = entry.Capabilities.SupportsFunctionCalling,
                Temperature = entry.Capabilities.Temperature,
                SupportedEfforts = entry.Capabilities.SupportedEfforts,
                MaxContextTokens = entry.Capabilities.MaxContextTokens,
                MaxOutputTokens = entry.Capabilities.MaxOutputTokens,
                DefaultMaxOutputTokens = entry.Capabilities.DefaultMaxOutputTokens,
                KnowledgeCutoff = entry.Capabilities.KnowledgeCutoff,
                TokenCountingScheme = entry.Capabilities.TokenCountingScheme
            }
        }).ToList();

        return Ok(entries);
    }
}

public class CatalogModelDto
{
    public string ModelId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    /// <summary>
    /// The <see cref="EndpointType"/> name. A string, not the enum, because this API has no
    /// string-enum converter — the other admin controllers convert the same way.
    /// </summary>
    public string Provider { get; set; } = string.Empty;
    /// <summary>The <see cref="Models.ApiProtocol"/> name, converted the same way as <see cref="Provider"/>.</summary>
    public string ApiProtocol { get; set; } = string.Empty;
    public ModelCapabilitiesDto Capabilities { get; set; } = new();
}
