using System;
using System.Text.RegularExpressions;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

/// <summary>
/// OneNote ids carry where the notebook lives. The user's own notebooks use plain Graph ids under
/// <c>me/onenote</c>. Notebooks owned by others live in their OneDrive or a SharePoint site and are
/// reached under <c>sites/{siteId}/onenote</c>; their ids are "sites/{siteId}|{graphId}" so the model
/// can pass them around like any other id.
/// </summary>
internal static class OneNoteSupport
{
    public static readonly string[] ReadScopes = [M365Scopes.NotesReadAll];
    public static readonly string[] WriteScopes = [M365Scopes.NotesReadWriteAll];

    private const char Separator = '|';
    private static readonly Regex SiteRoot = new(@"^sites/[A-Za-z0-9.,\-]+$", RegexOptions.Compiled);

    /// <summary>The id to hand to the model for a Graph id found under <paramref name="root"/>.</summary>
    public static string Id(string root, string graphId) => root == "me" ? graphId : $"{root}{Separator}{graphId}";

    /// <summary>The Graph path prefix ("me/onenote" or "sites/{id}/onenote") and escaped Graph id for a model-supplied id.</summary>
    public static (string Root, string Base, string GraphId) Split(string? id, string name)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ToolArgumentException($"{name} is required.");
        }

        var trimmed = id.Trim();
        var separator = trimmed.LastIndexOf(Separator);
        var root = separator < 0 ? "me" : trimmed[..separator];
        if (root != "me" && !SiteRoot.IsMatch(root))
        {
            throw new ToolArgumentException($"{name} is not a OneNote id from the list functions.");
        }

        return (root, $"{root}/onenote", Uri.EscapeDataString(trimmed[(separator + 1)..]));
    }
}
