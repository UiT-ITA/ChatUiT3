using ChatUiT.Server.Models;

namespace ChatUiT.Server.Services.Files;

/// <summary>The content read out of an uploaded file: text and images in reading order.</summary>
public sealed record ConvertedFile(IReadOnlyList<ConvertedPart> Parts)
{
    /// <summary>The parts as the chunks of a <see cref="ChatFile"/>, with their content.</summary>
    public List<ChatFileChunk> ToChunks() => Parts.Select(part => part switch
    {
        ConvertedText text => new ChatFileChunk { Type = "text", Text = text.Text },
        ConvertedImage image => new ChatFileChunk { Type = "image", MediaType = image.MediaType, Width = image.Width, Height = image.Height, Data = image.Data },
        _ => throw new InvalidOperationException($"Unknown converted part {part.GetType().Name}.")
    }).ToList();
}

public abstract record ConvertedPart;

public sealed record ConvertedText(string Text) : ConvertedPart;

public sealed record ConvertedImage(byte[] Data, string MediaType, int Width, int Height) : ConvertedPart;
