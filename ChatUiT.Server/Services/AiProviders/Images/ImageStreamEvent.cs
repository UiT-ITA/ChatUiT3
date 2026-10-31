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
/// rate limit. The message carries the service's reason and is safe to show.
/// </summary>
public sealed class ImageGenerationFailedException : Exception
{
    public ImageGenerationFailedException(string message, string? serviceResponse = null) : base(message)
    {
        ServiceResponse = serviceResponse;
    }

    /// <summary>The service's error body or stream event, unchanged. Null when the failure did not come from the service.</summary>
    public string? ServiceResponse { get; }
}
