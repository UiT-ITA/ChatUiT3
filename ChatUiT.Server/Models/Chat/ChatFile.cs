using System;
using System.Collections.Generic;
using System.Linq;

namespace ChatUiT.Server.Models;

/// <summary>One part of a file's content: text, or an image as bytes.</summary>
public class ChatFileChunk
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Type { get; set; } = string.Empty;
    public string? Text { get; set; }
    public string? Format { get; set; }
    public byte[]? Data { get; set; }

    public bool IsText => Type.Equals("text", StringComparison.OrdinalIgnoreCase);

    public bool IsImage => Type.Equals("image", StringComparison.OrdinalIgnoreCase);
}

/// <summary>
/// A file on a message or an assistant. A file uploaded since Blob Storage has its original and
/// its converted content there (<see cref="IsInBlobStorage"/>). An older file has its content in
/// Cosmos. <see cref="Chunks"/> always lists the file's parts, with the text and image bytes only
/// when the content is loaded.
/// </summary>
public class ChatFile
{
    public string Id { get; set; } = Guid.NewGuid().ToString();

    /// <summary>The file name. For a file in Blob Storage this is also the name it is stored under.</summary>
    public string SourceFilename { get; set; } = string.Empty;

    public bool IsInBlobStorage { get; set; }

    /// <summary>The size of the original in bytes. 0 for a file stored in Cosmos.</summary>
    public long Size { get; set; }

    public string ContentType { get; set; } = string.Empty;

    /// <summary>Whether the blobs were written encrypted with the chat owner's key.</summary>
    public bool IsEncrypted { get; set; }

    /// <summary>Token counting scheme id → tokens the file adds to the message that carries it. Set at upload.</summary>
    public Dictionary<string, int> TokenCounts { get; set; } = new();

    public List<ChatFileChunk> Chunks { get; set; } = new List<ChatFileChunk>();

    /// <summary>Whether <see cref="Chunks"/> holds the file's whole content.</summary>
    public bool IsContentLoaded => Chunks.All(chunk => chunk.Text != null || chunk.Data != null);
}
