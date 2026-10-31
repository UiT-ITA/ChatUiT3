using System.Collections.Generic;
using System.Linq;

namespace ChatUiT.Server.Models;

/// <summary>Maps models and their capabilities to and from their DTOs.</summary>
public static class ModelDtoMapper
{
    public static ModelDto ToDto(Model model) => model switch
    {
        LanguageModel language => ToDto(language),
        ImageModel image => ToDto(image),
        _ => throw new NotSupportedException($"{model.Type} models have no DTO yet.")
    };

    public static LanguageModelDto ToDto(LanguageModel model)
    {
        var dto = new LanguageModelDto
        {
            AllowedAsDefault = model.AllowedAsDefault,
            ExposedInApi = model.ExposedInApi,
            ApiProtocol = model.ApiProtocol,
            Classification = model.Classification,
            Capabilities = ToDto(model.Capabilities)
        };
        CopyCommonFields(model, dto);
        return dto;
    }

    public static ImageModelDto ToDto(ImageModel model)
    {
        var dto = new ImageModelDto
        {
            ImageApi = model.ImageApi,
            Capabilities = ToDto(model.Capabilities)
        };
        CopyCommonFields(model, dto);
        return dto;
    }

    public static LanguageModelCapabilitiesDto ToDto(LanguageModelCapabilities capabilities) => new()
    {
        SupportsVision = capabilities.SupportsVision,
        SupportsFunctionCalling = capabilities.SupportsFunctionCalling,
        Temperature = capabilities.Temperature,
        SupportedEfforts = capabilities.SupportedEfforts,
        MaxContextTokens = capabilities.MaxContextTokens,
        MaxOutputTokens = capabilities.MaxOutputTokens,
        DefaultMaxOutputTokens = capabilities.DefaultMaxOutputTokens,
        KnowledgeCutoff = capabilities.KnowledgeCutoff,
        TokenCountingScheme = capabilities.TokenCountingScheme
    };

    public static ImageModelCapabilitiesDto ToDto(ImageModelCapabilities capabilities) => new()
    {
        SizePresets = capabilities.SizePresets.Select(s => new ImageSizeDto { Width = s.Width, Height = s.Height }).ToList(),
        SupportsAutoSize = capabilities.SupportsAutoSize,
        SupportsCustomSize = capabilities.SupportsCustomSize,
        SizeMultiple = capabilities.SizeMultiple,
        MinSide = capabilities.MinSide,
        MaxSide = capabilities.MaxSide,
        MinPixels = capabilities.MinPixels,
        MaxPixels = capabilities.MaxPixels,
        MaxAspectRatio = capabilities.MaxAspectRatio,
        SupportsAutoAspectRatio = capabilities.SupportsAutoAspectRatio,
        Qualities = capabilities.Qualities.ToList(),
        MaxImagesPerRequest = capabilities.MaxImagesPerRequest,
        OutputFormats = capabilities.OutputFormats.ToList(),
        SupportsCompression = capabilities.SupportsCompression,
        Backgrounds = capabilities.Backgrounds.ToList(),
        ModerationLevels = capabilities.ModerationLevels.ToList(),
        MaxPartialImages = capabilities.MaxPartialImages,
        SupportsWebGrounding = capabilities.SupportsWebGrounding,
        MaxPromptCharacters = capabilities.MaxPromptCharacters,
        Editing = capabilities.Editing == null ? null : new ImageEditCapabilitiesDto
        {
            MaxInputImages = capabilities.Editing.MaxInputImages,
            InputFormats = capabilities.Editing.InputFormats.ToList(),
            MaxInputImageBytes = capabilities.Editing.MaxInputImageBytes,
            SupportsMask = capabilities.Editing.SupportsMask,
            SupportsMarkup = capabilities.Editing.SupportsMarkup,
            AcceptsGenerationSettings = capabilities.Editing.AcceptsGenerationSettings
        }
    };

    /// <summary>Lists are stored deduplicated and in enum order.</summary>
    public static ImageModelCapabilities ToCapabilities(ImageModelCapabilitiesDto dto) => new()
    {
        SizePresets = dto.SizePresets.Select(s => new ImageSize(s.Width, s.Height)).Distinct().ToList(),
        SupportsAutoSize = dto.SupportsAutoSize,
        SupportsCustomSize = dto.SupportsCustomSize,
        SizeMultiple = dto.SizeMultiple,
        MinSide = dto.MinSide,
        MaxSide = dto.MaxSide,
        MinPixels = dto.MinPixels,
        MaxPixels = dto.MaxPixels,
        MaxAspectRatio = dto.MaxAspectRatio,
        SupportsAutoAspectRatio = dto.SupportsAutoAspectRatio,
        Qualities = Normalize(dto.Qualities),
        MaxImagesPerRequest = dto.MaxImagesPerRequest,
        OutputFormats = dto.OutputFormats.Distinct().ToList(),
        SupportsCompression = dto.SupportsCompression,
        Backgrounds = Normalize(dto.Backgrounds),
        ModerationLevels = Normalize(dto.ModerationLevels),
        MaxPartialImages = dto.MaxPartialImages,
        SupportsWebGrounding = dto.SupportsWebGrounding,
        MaxPromptCharacters = dto.MaxPromptCharacters,
        Editing = dto.Editing == null ? null : new ImageEditCapabilities
        {
            MaxInputImages = dto.Editing.MaxInputImages,
            InputFormats = Normalize(dto.Editing.InputFormats),
            MaxInputImageBytes = dto.Editing.MaxInputImageBytes,
            SupportsMask = dto.Editing.SupportsMask,
            SupportsMarkup = dto.Editing.SupportsMarkup,
            AcceptsGenerationSettings = dto.Editing.AcceptsGenerationSettings
        }
    };

    private static void CopyCommonFields(Model model, ModelDto dto)
    {
        dto.Id = model.Id;
        dto.ModelId = model.ModelId;
        dto.ModelName = model.ModelName;
        dto.Description = model.Description;
        dto.EndpointId = model.EndpointId;
        dto.AllowedRoles = model.AllowedRoles;
    }

    private static List<T> Normalize<T>(IEnumerable<T>? values) where T : struct, Enum =>
        values == null ? new List<T>() : values.Distinct().OrderBy(v => v).ToList();
}
