using ChatUiT.Server.Models;

namespace ChatUiT.Server.Services.TokenCounting;

public abstract record MessagePart;

public sealed record TextPart(string Text) : MessagePart;

public sealed record ImagePart(string Base64, string MediaType) : MessagePart;

/// <summary>
/// The exact sequence of parts a user message becomes on the wire: the text, then each
/// attached file wrapped in header/footer lines with a part marker per chunk. Shared by the
/// provider that sends it and the counter that prices it, so they cannot drift apart. The
/// client mirrors these strings for the draft; change one and change the other.
/// </summary>
public static class MessageParts
{
    public const string ImageOmittedText = "[Image omitted: this model cannot read images]\n";

    public static List<MessagePart> Build(ChatMessage message, bool allowImages)
    {
        var parts = new List<MessagePart>();

        if (!string.IsNullOrEmpty(message.Content))
        {
            parts.Add(new TextPart(message.Content));
        }

        foreach (var file in message.Files ?? new List<ChatFile>())
        {
            AppendFile(file, parts, allowImages);
        }

        return parts;
    }

    private static void AppendFile(ChatFile file, List<MessagePart> parts, bool allowImages)
    {
        parts.Add(new TextPart($"\n--- ATTACHED FILE: {file.SourceFilename} ---\n"));

        for (var i = 0; i < file.Chunks.Count; i++)
        {
            var chunk = file.Chunks[i];
            parts.Add(new TextPart($"[File Part {i + 1} of {file.Chunks.Count}]\n"));

            if (chunk.Type.Equals("text", StringComparison.OrdinalIgnoreCase))
            {
                parts.Add(new TextPart((chunk.Text ?? string.Empty) + "\n"));
            }
            else if (chunk.Type.Equals("image", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(chunk.Base64))
            {
                if (!allowImages)
                {
                    // Better a visible note than an image the model will reject.
                    parts.Add(new TextPart(ImageOmittedText));
                    continue;
                }

                parts.Add(new ImagePart(chunk.Base64, ResolveMediaType(chunk.Format)));
                parts.Add(new TextPart("\n"));
            }
        }

        parts.Add(new TextPart($"--- END OF FILE: {file.SourceFilename} ---\n\n"));
    }

    /// <summary>
    /// Maps a chunk's format (e.g. "png") to a media type. Stricter providers reject an image
    /// whose declared media type does not match its actual bytes, so the format must be honoured.
    /// </summary>
    public static string ResolveMediaType(string? format)
    {
        var normalized = (format ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized.StartsWith("image/"))
        {
            return normalized;
        }

        return normalized switch
        {
            "png" => "image/png",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "jpg" or "jpeg" => "image/jpeg",
            _ => "image/jpeg"
        };
    }
}
