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

    /// <summary>The size of the original for a file in Blob Storage, else the size of the file's loaded chunks.</summary>
    public static long BytesOf(ChatFile file) => file.IsInBlobStorage
        ? file.Size
        : file.Chunks.Sum(chunk => chunk.Data?.LongLength ?? System.Text.Encoding.UTF8.GetByteCount(chunk.Text ?? string.Empty));
}
