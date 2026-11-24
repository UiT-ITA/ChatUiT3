using ChatUiT.Server.Models;

namespace ChatUiT.Server.Services.Files;

/// <summary>The content read out of an uploaded file: text and images in reading order.</summary>
public sealed record ConvertedFile(IReadOnlyList<ConvertedPart> Parts)
{
    /// <summary>The parts as the chunks of a <see cref="ChatFile"/>.</summary>
    public List<ChatFileChunk> ToChunks() => Parts.Select(part => part switch
    {
        ConvertedText text => new ChatFileChunk { Type = "text", Text = text.Text, Format = text.Format },
        ConvertedImage image => new ChatFileChunk { Type = "image", Data = image.Data, Format = image.MediaType },
        _ => throw new InvalidOperationException($"Unknown converted part {part.GetType().Name}.")
    }).ToList();
}

public abstract record ConvertedPart;

/// <param name="Format">"plain" or "markdown".</param>
public sealed record ConvertedText(string Text, string Format) : ConvertedPart;

public sealed record ConvertedImage(byte[] Data, string MediaType, int Width, int Height) : ConvertedPart;
