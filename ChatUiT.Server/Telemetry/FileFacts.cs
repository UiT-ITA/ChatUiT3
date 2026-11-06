using ChatUiT.Server.Models;

namespace ChatUiT.Server.Telemetry;

/// <summary>File metadata for telemetry: the type from the file name and the size from the chunks.</summary>
public static class FileFacts
{
    /// <summary>The file name's extension in lower case, without the dot. Null when it has none.</summary>
    public static string? TypeOf(string? fileName)
    {
        var extension = Path.GetExtension(fileName ?? string.Empty);
        return string.IsNullOrEmpty(extension) ? null : extension.TrimStart('.').ToLowerInvariant();
    }

    /// <summary>The size of the file's chunks: decoded bytes for base64 chunks, UTF-8 bytes for text chunks.</summary>
    public static long BytesOf(ChatFile file) => file.Chunks.Sum(chunk =>
        chunk.Base64 != null
            ? (long)chunk.Base64.Length * 3 / 4
            : System.Text.Encoding.UTF8.GetByteCount(chunk.Text ?? string.Empty));
}
