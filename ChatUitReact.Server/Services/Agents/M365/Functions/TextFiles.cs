using System;
using System.Collections.Generic;
using System.IO;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

/// <summary>Decides whether a file or attachment can be returned to the model as text.</summary>
internal static class TextFiles
{
    private static readonly HashSet<string> Extensions = new(StringComparer.OrdinalIgnoreCase)
        { ".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".xml", ".html", ".htm", ".yaml", ".yml", ".log", ".ini", ".cs", ".ts", ".js", ".py", ".sql" };

    public static bool IsText(string? name, string? mimeType)
        => Extensions.Contains(Path.GetExtension(name ?? string.Empty)) || (mimeType?.StartsWith("text/", StringComparison.OrdinalIgnoreCase) ?? false);

    /// <summary>Cuts <paramref name="text"/> to <paramref name="maxChars"/>; reports whether it did.</summary>
    public static (string Text, bool Truncated) Cap(string text, int maxChars)
        => text.Length > maxChars ? (text[..maxChars], true) : (text, false);
}
