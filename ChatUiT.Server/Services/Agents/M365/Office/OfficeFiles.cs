using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Services.Agents.M365.Functions;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Office;

/// <summary>
/// Downloads and saves Office files for the edit functions. The version is the item's eTag from
/// read_file: an edit is refused when the file changed after it was read, so paragraph and slide
/// numbers still point where the model thinks.
/// </summary>
internal static class OfficeFiles
{
    public const long MaxBytes = 25 * 1024 * 1024;

    private static readonly TimeSpan PreparedLifetime = TimeSpan.FromMinutes(15);
    private static readonly ConcurrentDictionary<string, Prepared> PreparedEdits = new();

    public sealed record Loaded(string Name, string ETag, string? WebUrl, byte[] Bytes);

    /// <summary>An edit built for the preview, kept until the user answers so the commit can upload it as is.</summary>
    public sealed record Prepared(string Arguments, Loaded Loaded, byte[] Bytes, List<string> Changes, DateTimeOffset Created);

    public static bool Is(string? name, string extension)
        => string.Equals(Path.GetExtension(name ?? string.Empty), extension, StringComparison.OrdinalIgnoreCase);

    public static async Task<Loaded> LoadAsync(GraphClient graph, ToolExecutionContext context, string driveId, string itemId, string extension, string version, CancellationToken ct)
    {
        var path = DriveSupport.ItemPath(driveId, itemId);
        var item = await graph.GetAsync(context, $"{path}?$select=name,size,eTag,webUrl", DriveSupport.Scopes, ct);
        var name = item.Str("name") ?? string.Empty;

        if (!Is(name, extension))
        {
            throw new ToolArgumentException($"{name} is not a {extension} file.");
        }

        if (long.TryParse(item.Str("size"), out var size) && size > MaxBytes)
        {
            throw new ToolArgumentException($"{name} is larger than {MaxBytes / (1024 * 1024)} MB.");
        }

        var eTag = item.Str("eTag") ?? string.Empty;
        if (!string.Equals(eTag, version?.Trim(), StringComparison.Ordinal))
        {
            throw new ToolArgumentException("The file has changed since it was read. Read it again with read_file and use the new version and numbers.");
        }

        var bytes = await graph.GetBytesAsync(context, $"{path}/content", DriveSupport.Scopes, MaxBytes, ct);
        return new Loaded(name, eTag, item.Str("webUrl"), bytes);
    }

    /// <summary>Keeps the edit built for <paramref name="invocation"/>'s preview, and drops edits older than 15 minutes.</summary>
    public static void Remember<TArgs>(ToolInvocation invocation, TArgs arguments, Loaded loaded, byte[] bytes, List<string> changes)
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var stale in PreparedEdits.Where(e => now - e.Value.Created > PreparedLifetime).Select(e => e.Key).ToList())
        {
            PreparedEdits.TryRemove(stale, out _);
        }

        PreparedEdits[Key(invocation)] = new Prepared(JsonSerializer.Serialize(arguments, ToolSchema.Options), loaded, bytes, changes, now);
    }

    /// <summary>The edit kept for <paramref name="invocation"/> when it was built from the same arguments, removing it.</summary>
    public static Prepared? Take<TArgs>(ToolInvocation invocation, TArgs arguments)
        => PreparedEdits.TryRemove(Key(invocation), out var prepared) && prepared.Arguments == JsonSerializer.Serialize(arguments, ToolSchema.Options) && DateTimeOffset.UtcNow - prepared.Created <= PreparedLifetime
            ? prepared
            : null;

    public static string Required(string? value, string name)
        => string.IsNullOrEmpty(value) ? throw new ToolArgumentException($"{name} is required.") : value;

    public static string Numbered(IEnumerable<string> changes) => string.Join("\n", changes.Select((c, i) => $"{i + 1}. {c}"));

    private static string Key(ToolInvocation invocation) => $"{invocation.Context.UserId}/{invocation.Context.MessageId}/{invocation.ToolCallId}";

    /// <summary>Uploads the edited file in place of the version that was loaded.</summary>
    public static async Task<JsonElement> SaveAsync(GraphClient graph, ToolExecutionContext context, string driveId, string itemId, Loaded loaded, byte[] bytes, string mediaType, CancellationToken ct)
    {
        try
        {
            return await graph.SendBytesAsync(context, HttpMethod.Put, $"{DriveSupport.ItemPath(driveId, itemId)}/content", bytes, mediaType, DriveSupport.Scopes, ct, ifMatch: loaded.ETag);
        }
        catch (GraphRequestException ex) when (ex.Status == HttpStatusCode.PreconditionFailed)
        {
            throw new ToolArgumentException("The file changed while it was being edited, so nothing was saved. Read it again with read_file.");
        }
    }
}
