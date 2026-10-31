using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Catalog;

namespace ChatUiT.Server.Controllers;

/// <summary>
/// Capability defaults for known models of every type, so the admin forms can prefill instead
/// of asking someone to remember whether gpt-5.4 accepts a temperature.
/// </summary>
[ApiController]
[Route("api/admin/model-catalog")]
[Authorize(Roles = "Admin")]
public class AdminModelCatalogController : ControllerBase
{
    [HttpGet]
    public ActionResult<List<CatalogModelDto>> GetCatalog()
    {
        var entries = ModelCatalog.All.Select(ToDto).ToList();
        return Ok(entries);
    }

    private static CatalogModelDto ToDto(CatalogModel entry)
    {
        CatalogModelDto dto = entry switch
        {
            LanguageCatalogModel language => new LanguageCatalogModelDto
            {
                ApiProtocol = language.ApiProtocol,
                Capabilities = ModelDtoMapper.ToDto(language.Capabilities)
            },
            ImageCatalogModel image => new ImageCatalogModelDto
            {
                ImageApi = image.ImageApi,
                Capabilities = ModelDtoMapper.ToDto(image.Capabilities)
            },
            _ => throw new NotSupportedException($"{entry.Type} catalog entries have no DTO yet.")
        };

        dto.ModelId = entry.ModelId;
        dto.DisplayName = entry.DisplayName;
        dto.Description = entry.Description;
        dto.Provider = entry.Provider.ToString();
        return dto;
    }
}

/// <summary>A catalog entry. <c>type</c> names the subclass.</summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(LanguageCatalogModelDto), nameof(ModelType.Language))]
[JsonDerivedType(typeof(ImageCatalogModelDto), nameof(ModelType.Image))]
public abstract class CatalogModelDto
{
    public string ModelId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    /// <summary>
    /// The <see cref="EndpointType"/> name. A string, not the enum, because <see cref="EndpointType"/>
    /// has no string-enum converter — the other admin controllers convert the same way.
    /// </summary>
    public string Provider { get; set; } = string.Empty;
}

public class LanguageCatalogModelDto : CatalogModelDto
{
    public ApiProtocol ApiProtocol { get; set; }
    public LanguageModelCapabilitiesDto Capabilities { get; set; } = new();
}

public class ImageCatalogModelDto : CatalogModelDto
{
    public ImageApi ImageApi { get; set; }
    public ImageModelCapabilitiesDto Capabilities { get; set; } = new();
}
