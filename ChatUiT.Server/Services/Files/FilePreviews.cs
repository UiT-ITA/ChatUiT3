using ChatUiT.Server.Models;

namespace ChatUiT.Server.Services.Files;

/// <summary>How the web client shows a file's original. Switched off in stage 1: nothing calls this.</summary>
public static class FilePreviews
{
    public const string Pdf = "pdf";
    public const string Image = "image";
    public const string Text = "text";
    public const string Markdown = "markdown";

    /// <summary>The file can only be downloaded.</summary>
    public const string Download = "download";

    /// <summary>The file has no original and its content cannot stand in for one.</summary>
    public const string Unavailable = "unavailable";

    /// <summary>
    /// PDF, image and text files preview inline. Word, PowerPoint and Excel files are download
    /// only. A file stored in Cosmos previews as text when its content is only text, and as an
    /// image when its content is one image. Other files stored in Cosmos have no preview.
    /// </summary>
    public static string KindOf(ChatFile file)
    {
        if (file.IsInBlobStorage)
        {
            return FileKinds.Resolve(file.SourceFilename, file.ContentType) switch
            {
                FileKind.Pdf => Pdf,
                FileKind.Image => Image,
                FileKind.Text => Text,
                FileKind.Markdown => Markdown,
                _ => Download
            };
        }

        if (file.Chunks.Count == 1 && file.Chunks[0].IsImage)
        {
            return Image;
        }

        if (file.Chunks.Count > 0 && file.Chunks.All(chunk => chunk.IsText))
        {
            return file.Chunks.All(chunk => chunk.Format == "markdown") ? Markdown : Text;
        }

        return Unavailable;
    }

    /// <summary>Whether a file with this name is already of the type served with <paramref name="extension"/>.</summary>
    public static bool ServedAsIs(string fileName, string extension)
    {
        var kind = FileKinds.Resolve(fileName, null);
        return extension switch
        {
            ".txt" => kind is FileKind.Text or FileKind.Markdown,
            ".png" => Path.GetExtension(fileName).Equals(".png", StringComparison.OrdinalIgnoreCase),
            _ => Path.GetExtension(fileName).ToLowerInvariant() is ".jpg" or ".jpeg"
        };
    }
}
