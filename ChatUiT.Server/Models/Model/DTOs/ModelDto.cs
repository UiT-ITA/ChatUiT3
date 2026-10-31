using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace ChatUiT.Server.Models;

public class LanguageModelCapabilitiesDto
{
    [Required]
    public bool SupportsVision { get; set; }

    [Required]
    public bool SupportsFunctionCalling { get; set; }

    /// <summary>"Unsupported" | "Supported" | "SupportedWhenReasoningDisabled".</summary>
    [Required]
    public TemperatureSupport Temperature { get; set; }

    /// <summary>
    /// Ascending list of accepted reasoning levels. Empty means the model does not reason;
    /// omitting "None" means reasoning cannot be switched off.
    /// </summary>
    [Required]
    public List<ReasoningEffort> SupportedEfforts { get; set; } = new List<ReasoningEffort>();

    [Required]
    public int MaxContextTokens { get; set; }

    [Required]
    public int MaxOutputTokens { get; set; }

    [Required]
    public int DefaultMaxOutputTokens { get; set; }

    /// <summary>Null when unknown.</summary>
    public DateTime? KnowledgeCutoff { get; set; }

    /// <summary>Token counting scheme id, or null when the model has no counter.</summary>
    public string? TokenCountingScheme { get; set; }
}

public class ImageSizeDto
{
    [Required]
    public int Width { get; set; }

    [Required]
    public int Height { get; set; }
}

/// <summary>See <see cref="ImageModelCapabilities"/>. A null limit means the model has none.</summary>
public class ImageModelCapabilitiesDto
{
    [Required]
    public List<ImageSizeDto> SizePresets { get; set; } = new List<ImageSizeDto>();

    public bool SupportsAutoSize { get; set; }
    public bool SupportsCustomSize { get; set; }
    public int? SizeMultiple { get; set; }
    public int? MinSide { get; set; }
    public int? MaxSide { get; set; }
    public long? MinPixels { get; set; }
    public long? MaxPixels { get; set; }
    public double? MaxAspectRatio { get; set; }
    public bool SupportsAutoAspectRatio { get; set; }

    [Required]
    public List<ImageQuality> Qualities { get; set; } = new List<ImageQuality>();

    [Required]
    public int MaxImagesPerRequest { get; set; }

    [Required]
    public List<ImageFormat> OutputFormats { get; set; } = new List<ImageFormat>();

    public bool SupportsCompression { get; set; }

    [Required]
    public List<ImageBackground> Backgrounds { get; set; } = new List<ImageBackground>();

    [Required]
    public List<ImageModeration> ModerationLevels { get; set; } = new List<ImageModeration>();

    public int MaxPartialImages { get; set; }
    public bool SupportsWebGrounding { get; set; }
    public int? MaxPromptCharacters { get; set; }

    /// <summary>Null when the model cannot edit images.</summary>
    public ImageEditCapabilitiesDto? Editing { get; set; }
}

public class ImageEditCapabilitiesDto
{
    [Required]
    public int MaxInputImages { get; set; }

    [Required]
    public List<ImageFormat> InputFormats { get; set; } = new List<ImageFormat>();

    public long? MaxInputImageBytes { get; set; }
    public bool SupportsMask { get; set; }
    public bool SupportsMarkup { get; set; }
    public bool AcceptsGenerationSettings { get; set; }
}

/// <summary>A model as the admin panel sees it. <c>type</c> names the subclass.</summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(LanguageModelDto), nameof(ModelType.Language))]
[JsonDerivedType(typeof(ImageModelDto), nameof(ModelType.Image))]
public abstract class ModelDto
{
    [Required]
    public string Id { get; set; } = string.Empty;

    [Required]
    public string ModelId { get; set; } = string.Empty; // Provider model identifier or deployment name

    [Required]
    public string ModelName { get; set; } = string.Empty; // Friendly/display name

    [Required]
    public string Description { get; set; } = string.Empty;

    [Required]
    public string EndpointId { get; set; } = string.Empty;

    [Required]
    public List<UserRole> AllowedRoles { get; set; } = new List<UserRole>();
}

public class LanguageModelDto : ModelDto
{
    /// <summary>
    /// Whether a user may pin an assistant on this model as their default assistant.
    /// Cost control, not a capability.
    /// </summary>
    public bool AllowedAsDefault { get; set; }

    /// <summary>Whether the Responses API serves this model, under its ModelId.</summary>
    public bool ExposedInApi { get; set; }

    [Required]
    public LanguageModelCapabilitiesDto Capabilities { get; set; } = new LanguageModelCapabilitiesDto();

    [Required]
    public ApiProtocol ApiProtocol { get; set; }

    [Required]
    public DataClassification Classification { get; set; }
}

public class ImageModelDto : ModelDto
{
    [Required]
    public ImageApi ImageApi { get; set; }

    [Required]
    public ImageModelCapabilitiesDto Capabilities { get; set; } = new ImageModelCapabilitiesDto();
}

/// <summary>The fields every model type is saved with. The id comes from the route on an update.</summary>
public abstract class SaveModelDto
{
    [Required]
    public string ModelId { get; set; } = string.Empty;

    [Required]
    public string ModelName { get; set; } = string.Empty;

    [Required]
    public string Description { get; set; } = string.Empty;

    [Required]
    public string EndpointId { get; set; } = string.Empty;

    [Required]
    public List<UserRole> AllowedRoles { get; set; } = new List<UserRole>();
}

public class SaveLanguageModelDto : SaveModelDto
{
    public bool AllowedAsDefault { get; set; }

    public bool ExposedInApi { get; set; }

    [Required]
    public LanguageModelCapabilitiesDto Capabilities { get; set; } = new LanguageModelCapabilitiesDto();

    [Required]
    public ApiProtocol ApiProtocol { get; set; }

    [Required]
    public DataClassification Classification { get; set; }
}

public class SaveImageModelDto : SaveModelDto
{
    [Required]
    public ImageApi ImageApi { get; set; }

    [Required]
    public ImageModelCapabilitiesDto Capabilities { get; set; } = new ImageModelCapabilitiesDto();
}

public class ModelTestResultDto
{
    public bool Success { get; set; }
    public string? Response { get; set; }
    public string? Error { get; set; }
}
