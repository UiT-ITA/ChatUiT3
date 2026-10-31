using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace ChatUiT.Server.Models;

/// <summary>A model that generates and edits images.</summary>
public class ImageModel : Model
{
    public override ModelType Type => ModelType.Image;

    /// <summary>How this model is spoken to on the wire.</summary>
    public ImageApi ImageApi { get; set; }

    public ImageModelCapabilities Capabilities { get; set; } = new ImageModelCapabilities();
}

/// <summary>The wire API an image model is called with.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ImageApi
{
    /// <summary>POST {base}/images/generations and {base}/images/edits, OpenAI shape. gpt-image models.</summary>
    OpenAiImages,

    /// <summary>POST {base}/images/generations and {base}/images/edits under /mai/v1. MAI-Image models.</summary>
    MaiImages
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ImageQuality
{
    Auto,
    Low,
    Medium,
    High,
    XHigh,
    Max
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ImageFormat
{
    Png,
    Jpeg,
    Webp
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ImageBackground
{
    Auto,
    Opaque,
    Transparent
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ImageModeration
{
    Auto,
    Low
}

/// <summary>A width and height in pixels.</summary>
public sealed record ImageSize(int Width, int Height);

/// <summary>
/// What a single image model supports. A null limit means the model has none. The API
/// differences (how the size is sent, which form an edit takes) live in the image API
/// adapters, not here.
/// </summary>
public class ImageModelCapabilities
{
    /// <summary>Sizes offered as presets. Any other size that passes the size rules is also accepted when <see cref="SupportsCustomSize"/> is set.</summary>
    public List<ImageSize> SizePresets { get; set; } = new List<ImageSize>();

    /// <summary>Whether the model can pick the size itself.</summary>
    public bool SupportsAutoSize { get; set; }

    public bool SupportsCustomSize { get; set; }

    /// <summary>Both sides must be a multiple of this.</summary>
    public int? SizeMultiple { get; set; }

    public int? MinSide { get; set; }
    public int? MaxSide { get; set; }
    public long? MinPixels { get; set; }
    public long? MaxPixels { get; set; }

    /// <summary>The longest side divided by the shortest side may not exceed this.</summary>
    public double? MaxAspectRatio { get; set; }

    /// <summary>Whether the model can pick the aspect ratio for the size given.</summary>
    public bool SupportsAutoAspectRatio { get; set; }

    /// <summary>The quality levels the model accepts. Empty means the model has no quality setting.</summary>
    public List<ImageQuality> Qualities { get; set; } = new List<ImageQuality>();

    public int MaxImagesPerRequest { get; set; } = 1;

    /// <summary>The formats the model can return. The first is used when none is asked for.</summary>
    public List<ImageFormat> OutputFormats { get; set; } = new List<ImageFormat> { ImageFormat.Png };

    /// <summary>Whether a compression level can be set for JPEG and WebP output.</summary>
    public bool SupportsCompression { get; set; }

    /// <summary>The backgrounds the model accepts. Empty means the model has no background setting.</summary>
    public List<ImageBackground> Backgrounds { get; set; } = new List<ImageBackground>();

    /// <summary>The moderation levels the model accepts on generations. Empty means the model has no moderation setting.</summary>
    public List<ImageModeration> ModerationLevels { get; set; } = new List<ImageModeration>();

    /// <summary>How many partial images the model can stream before the final one. 0 means no streaming.</summary>
    public int MaxPartialImages { get; set; }

    /// <summary>Whether the model can use web search results as context.</summary>
    public bool SupportsWebGrounding { get; set; }

    public int? MaxPromptCharacters { get; set; }

    /// <summary>What the model accepts when editing images. Null means the model cannot edit.</summary>
    public ImageEditCapabilities? Editing { get; set; }
}

public class ImageEditCapabilities
{
    public int MaxInputImages { get; set; } = 1;

    public List<ImageFormat> InputFormats { get; set; } = new List<ImageFormat> { ImageFormat.Png, ImageFormat.Jpeg };

    public long? MaxInputImageBytes { get; set; }

    /// <summary>Whether a PNG mask with an alpha channel can mark the area to change in the first image.</summary>
    public bool SupportsMask { get; set; }

    /// <summary>Whether a transparent PNG drawn over the first image can show what to change. Not together with a mask.</summary>
    public bool SupportsMarkup { get; set; }

    /// <summary>
    /// Whether an edit accepts the generation settings: size, quality, count, format,
    /// compression, background and partial images. When false an edit takes the prompt and the
    /// images only.
    /// </summary>
    public bool AcceptsGenerationSettings { get; set; }
}
