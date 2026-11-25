using ChatUiT.Server.Models;

namespace ChatUiT.Server.Telemetry;

/// <summary>File metadata for telemetry: the type from the file name and the size.</summary>
public static class FileFacts
{
    /// <summary>The file name's extension in lower case, without the dot. Null when it has none.</summary>
    public static string? TypeOf(string? fileName)
    {
        var extension = Path.GetExtension(fileName ?? string.Empty);
        return string.IsNullOrEmpty(extension) ? null : extension.TrimStart('.').ToLowerInvariant();
    }

    /// <summary>The size of the original. A file sent to the Responses API has none, and gets the size of its chunks.</summary>
    public static long BytesOf(ChatFile file) => file.Size > 0
        ? file.Size
        : file.Chunks.Sum(chunk => chunk.Data?.LongLength ?? System.Text.Encoding.UTF8.GetByteCount(chunk.Text ?? string.Empty));
}
