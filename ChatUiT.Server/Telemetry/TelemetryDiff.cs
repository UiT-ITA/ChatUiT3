using System.Text.Json;
using System.Text.Json.Nodes;

namespace ChatUiT.Server.Telemetry;

/// <summary>
/// The difference between two versions of an entity, for <c>admin.changed</c> and
/// <c>assistant.updated</c>. Both versions are serialised to JSON and flattened to dotted paths.
/// Paths in the value-less set are reported as changed without their values.
/// </summary>
public static class TelemetryDiff
{
    private const int MaxValueLength = 200;

    public sealed record Result(IReadOnlyList<string> Changed, string? Changes);

    /// <param name="before">The entity before the change, or null when it was created.</param>
    /// <param name="after">The entity after the change, or null when it was deleted.</param>
    /// <param name="valueless">Paths whose values are never written, only that they changed.</param>
    /// <param name="includeOld">False writes only the new values.</param>
    public static Result Compute(object? before, object? after, IReadOnlySet<string>? valueless = null, bool includeOld = true)
    {
        var old = Flatten(before);
        var current = Flatten(after);
        var changed = old.Keys.Union(current.Keys)
            .Where(path => !Equals(old.GetValueOrDefault(path), current.GetValueOrDefault(path)))
            .OrderBy(path => path, StringComparer.Ordinal)
            .ToList();

        if (changed.Count == 0)
        {
            return new Result(changed, null);
        }

        var changes = new JsonObject();
        foreach (var path in changed)
        {
            if (valueless != null && valueless.Contains(path))
            {
                changes[path] = "changed";
                continue;
            }

            var entry = new JsonObject();
            if (includeOld)
            {
                entry["old"] = old.GetValueOrDefault(path);
            }

            entry["new"] = current.GetValueOrDefault(path);
            changes[path] = entry;
        }

        return new Result(changed, changes.ToJsonString());
    }

    /// <summary>A SHA-256 of the value, for comparing a value-less path without holding its value.</summary>
    public static string Fingerprint(string? value) =>
        Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(value ?? string.Empty)));

    private static Dictionary<string, string?> Flatten(object? value)
    {
        var result = new Dictionary<string, string?>(StringComparer.Ordinal);
        if (value != null)
        {
            Walk(JsonSerializer.SerializeToElement(value, JsonSerializerOptions.Web), string.Empty, result);
        }

        return result;
    }

    private static void Walk(JsonElement element, string path, Dictionary<string, string?> result)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                {
                    Walk(property.Value, path.Length == 0 ? property.Name : $"{path}.{property.Name}", result);
                }
                break;
            case JsonValueKind.Null:
            case JsonValueKind.Undefined:
                result[path] = null;
                break;
            case JsonValueKind.String:
                result[path] = Truncate(element.GetString());
                break;
            default:
                result[path] = Truncate(element.GetRawText());
                break;
        }
    }

    private static string? Truncate(string? value) =>
        value == null || value.Length <= MaxValueLength ? value : value[..MaxValueLength] + "…";
}
