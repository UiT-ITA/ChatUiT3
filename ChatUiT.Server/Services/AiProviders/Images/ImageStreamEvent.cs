namespace ChatUiT.Server.Services.AiProviders.Images;

using ChatUiT.Server.Models;

/// <summary>What an image API emits while one request runs.</summary>
public abstract record ImageStreamEvent
{
    /// <summary>An unfinished version of image <paramref name="ImageIndex"/>.</summary>
    public sealed record PartialImage(int ImageIndex, int PartialIndex, byte[] Content, ImageFormat Format) : ImageStreamEvent;

    /// <summary>Image <paramref name="ImageIndex"/>, finished.</summary>
    public sealed record Image(int ImageIndex, byte[] Content, ImageFormat Format) : ImageStreamEvent;

    /// <summary>The tokens the request used, when the API reports them.</summary>
    public sealed record Usage(int InputTokens, int OutputTokens) : ImageStreamEvent;
}

/// <summary>
/// The image API refused or failed the request: a content filter, a rejected parameter, a
/// rate limit. The message carries the service's reason and is safe to show. The message is
/// never logged: <see cref="Category"/> and <see cref="Code"/> are.
/// </summary>
public sealed class ImageGenerationFailedException : Exception, Telemetry.IContentCarryingException
{
    public ImageGenerationFailedException(string message, string category, string? code = null) : base(message)
    {
        Category = category;
        Code = code;
    }

    /// <summary>The error category, one of <see cref="Telemetry.ErrorCategories"/>.</summary>
    public string Category { get; }

    /// <summary>The service's error code, or the HTTP status when it sent no code.</summary>
    public string? Code { get; }
}
