using System;
using System.Linq;
using System.Text.Json;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

/// <summary>OneDrive path handling and drive item projection shared by the file functions.</summary>
internal static class DriveSupport
{
    public static readonly string[] Scopes = [M365Scopes.FilesReadWriteAll];

    /// <summary>A relative OneDrive path with forward slashes and no leading or trailing slash.</summary>
    public static string Normalise(string? path)
    {
        var trimmed = (path ?? string.Empty).Replace('\\', '/').Trim().Trim('/');
        if (trimmed.Length == 0 || trimmed.Contains("..", StringComparison.Ordinal))
        {
            throw new ToolArgumentException("path must be a relative OneDrive path without '..'.");
        }

        return trimmed;
    }

    public static string EscapePath(string path) => string.Join('/', path.Split('/', StringSplitOptions.RemoveEmptyEntries).Select(Uri.EscapeDataString));

    public static string ItemPath(string driveId, string itemId)
    {
        if (string.IsNullOrWhiteSpace(driveId) || string.IsNullOrWhiteSpace(itemId))
        {
            throw new ToolArgumentException("driveId and itemId are required.");
        }

        return $"drives/{Uri.EscapeDataString(driveId.Trim())}/items/{Uri.EscapeDataString(itemId.Trim())}";
    }

    public static object Item(JsonElement i) => new
    {
        name = i.Str("name"),
        isFolder = i.TryGetProperty("folder", out _),
        driveId = i.Str("parentReference", "driveId"),
        itemId = i.Str("id"),
        size = i.Str("size"),
        lastModified = i.Str("lastModifiedDateTime"),
        webUrl = i.Str("webUrl")
    };

    public const string ItemFields = "id,name,size,lastModifiedDateTime,webUrl,folder,parentReference";
}
