using ChatUiT.Server.Models;

namespace ChatUiT.Server.Services.Files;

/// <summary>Where a file's content lies.</summary>
public static class FileStorage
{
    /// <summary>A file in Blob Storage has the content type of its original. A file in the database has none.</summary>
    public static bool IsInBlobStorage(ChatFile file) => file.ContentType.Length > 0;
}
