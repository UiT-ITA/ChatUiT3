namespace ChatUiT.Server.Services.Files;

public enum FileKind
{
    Image,
    Text,
    Markdown,
    Pdf,
    Docx,
    Pptx,
    Xlsx
}

/// <summary>Which files are accepted, and how each is converted and previewed.</summary>
public static class FileKinds
{
    public const long MaxFileBytes = 100L * 1024 * 1024;

    private static readonly Dictionary<string, FileKind> ByExtension = new(StringComparer.OrdinalIgnoreCase)
    {
        [".txt"] = FileKind.Text,
        [".csv"] = FileKind.Text,
        [".json"] = FileKind.Text,
        [".md"] = FileKind.Markdown,
        [".markdown"] = FileKind.Markdown,
        [".pdf"] = FileKind.Pdf,
        [".docx"] = FileKind.Docx,
        [".pptx"] = FileKind.Pptx,
        [".xlsx"] = FileKind.Xlsx,
        [".jpg"] = FileKind.Image,
        [".jpeg"] = FileKind.Image,
        [".png"] = FileKind.Image,
        [".bmp"] = FileKind.Image,
        [".webp"] = FileKind.Image,
        [".gif"] = FileKind.Image
    };

    private static readonly Dictionary<string, FileKind> ByContentType = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = FileKind.Image,
        ["image/png"] = FileKind.Image,
        ["image/bmp"] = FileKind.Image,
        ["image/webp"] = FileKind.Image,
        ["image/gif"] = FileKind.Image,
        ["text/plain"] = FileKind.Text,
        ["text/csv"] = FileKind.Text,
        ["application/json"] = FileKind.Text,
        ["text/markdown"] = FileKind.Markdown
    };

    private static readonly Dictionary<string, string> ContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".txt"] = "text/plain",
        [".csv"] = "text/csv",
        [".json"] = "application/json",
        [".md"] = "text/markdown",
        [".markdown"] = "text/markdown",
        [".pdf"] = "application/pdf",
        [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        [".pptx"] = "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".png"] = "image/png",
        [".bmp"] = "image/bmp",
        [".webp"] = "image/webp",
        [".gif"] = "image/gif"
    };

    /// <summary>The kind of an accepted file, from its extension and else its content type. Null when the file is not accepted.</summary>
    public static FileKind? Resolve(string fileName, string? contentType)
    {
        if (ByExtension.TryGetValue(Path.GetExtension(fileName), out var kind))
        {
            return kind;
        }

        var mediaType = (contentType ?? string.Empty).Split(';')[0].Trim();
        return ByContentType.TryGetValue(mediaType, out kind) ? kind : null;
    }

    /// <summary>The content type the original is served with.</summary>
    public static string ContentTypeOf(string fileName, string? uploadedContentType)
    {
        if (ContentTypes.TryGetValue(Path.GetExtension(fileName), out var contentType))
        {
            return contentType;
        }

        var mediaType = (uploadedContentType ?? string.Empty).Split(';')[0].Trim();
        return ByContentType.ContainsKey(mediaType) ? mediaType.ToLowerInvariant() : "application/octet-stream";
    }
}
