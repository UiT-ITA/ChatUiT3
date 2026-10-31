using System;
using System.Collections.Generic;
using System.Linq;

namespace ChatUiT.Server.Models;

public class MediaGenerationDto
{
    public string Id { get; set; } = string.Empty;
    public ModelType Type { get; set; }
    public string ModelId { get; set; } = string.Empty;
    public string ModelName { get; set; } = string.Empty;
    public string Prompt { get; set; } = string.Empty;
    public MediaGenerationStatus Status { get; set; }
    public string? Error { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public int? InputTokens { get; set; }
    public int? OutputTokens { get; set; }
    public List<MediaOutputDto> Outputs { get; set; } = new();

    public static MediaGenerationDto From(MediaGeneration generation) => new()
    {
        Id = generation.Id,
        Type = generation.Type,
        ModelId = generation.ModelId,
        ModelName = generation.ModelName,
        Prompt = generation.Prompt,
        Status = generation.Status,
        Error = generation.Error,
        CreatedAt = generation.CreatedAt,
        FinishedAt = generation.FinishedAt,
        InputTokens = generation.InputTokens,
        OutputTokens = generation.OutputTokens,
        Outputs = generation.Outputs.Select(o => new MediaOutputDto
        {
            Id = o.Id,
            Index = o.Index,
            PartialIndex = o.PartialIndex,
            MediaType = o.MediaType
        }).ToList()
    };
}

/// <summary>An output without its content, which is downloaded by id.</summary>
public class MediaOutputDto
{
    public string Id { get; set; } = string.Empty;
    public int Index { get; set; }
    public int? PartialIndex { get; set; }
    public string MediaType { get; set; } = string.Empty;
}

/// <summary>
/// The settings of an image generation or edit. Input images, the mask and the markup travel
/// as files beside it. A null setting is left to the model.
/// </summary>
public class ImageGenerationRequestDto
{
    public string Prompt { get; set; } = string.Empty;
    public ImageSizeDto? Size { get; set; }
    public bool AutoAspectRatio { get; set; }
    public ImageQuality? Quality { get; set; }
    public int Count { get; set; } = 1;
    public ImageFormat? OutputFormat { get; set; }
    public int? Compression { get; set; }
    public ImageBackground? Background { get; set; }
    public ImageModeration? Moderation { get; set; }
    public int PartialImages { get; set; }
    public bool WebGrounding { get; set; }
}

/// <summary>A prompt to refine for an image model. <c>IsEdit</c> means it describes changes to input images.</summary>
public class RefineImagePromptRequestDto
{
    public string Prompt { get; set; } = string.Empty;
    public bool IsEdit { get; set; }
}

public class RefineImagePromptResultDto
{
    public string Prompt { get; set; } = string.Empty;
}

/// <summary>An image model as a user sees it: what to call it and what the form can offer.</summary>
public class UserImageModelDto
{
    public string Id { get; set; } = string.Empty;
    public string ModelName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public ImageModelCapabilitiesDto Capabilities { get; set; } = new();
}
