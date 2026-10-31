using System.Collections.Generic;

namespace ChatUiT.Server.Services.AiProviders.Images;

using ChatUiT.Server.Models;

/// <summary>One image generation or edit, expressed in terms every image API understands.</summary>
public sealed record ImageRequest
{
    public required ImageModel Model { get; init; }

    public required ModelEndpoint Endpoint { get; init; }

    public required ImageGenerationParameters Parameters { get; init; }
}

/// <summary>
/// What the user asked for. A null setting is left to the model. A request with
/// <see cref="InputImages"/> is an edit; one without is a generation.
/// </summary>
public sealed record ImageGenerationParameters
{
    public string Prompt { get; init; } = string.Empty;

    /// <summary>Null lets the model pick the size.</summary>
    public ImageSize? Size { get; init; }

    public bool AutoAspectRatio { get; init; }

    public ImageQuality? Quality { get; init; }

    public int Count { get; init; } = 1;

    public ImageFormat? OutputFormat { get; init; }

    /// <summary>0 to 100, for JPEG and WebP output.</summary>
    public int? Compression { get; init; }

    public ImageBackground? Background { get; init; }

    public ImageModeration? Moderation { get; init; }

    public int PartialImages { get; init; }

    public bool WebGrounding { get; init; }

    public IReadOnlyList<ImageInput> InputImages { get; init; } = new List<ImageInput>();

    /// <summary>A PNG whose transparent area marks what to change in the first input image.</summary>
    public ImageInput? Mask { get; init; }

    /// <summary>A transparent PNG drawn over the first input image to show what to change.</summary>
    public ImageInput? Markup { get; init; }

    public bool IsEdit => InputImages.Count > 0;
}

/// <summary>An image sent to the model.</summary>
public sealed record ImageInput(byte[] Content, ImageFormat Format, string FileName);
