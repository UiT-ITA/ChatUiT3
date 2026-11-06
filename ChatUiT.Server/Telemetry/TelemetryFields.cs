using System.Collections;

namespace ChatUiT.Server.Telemetry;

/// <summary>
/// The fields of one telemetry record, in the order they were added. Null values are left out
/// by the exporter. Lists are joined with commas.
/// </summary>
public sealed class TelemetryFields : IEnumerable<KeyValuePair<string, object?>>
{
    private readonly List<KeyValuePair<string, object?>> _items = new();

    public object? this[string key]
    {
        set => _items.Add(new(key, value));
    }

    public IReadOnlyList<KeyValuePair<string, object?>> Items => _items;

    public void Add(string key, object? value) => _items.Add(new(key, value));

    public static string? Join(IEnumerable<string?>? values)
    {
        if (values == null)
        {
            return null;
        }

        var list = values.Where(v => !string.IsNullOrEmpty(v)).ToList();
        return list.Count == 0 ? null : string.Join(",", list);
    }

    public IEnumerator<KeyValuePair<string, object?>> GetEnumerator() => _items.GetEnumerator();

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

/// <summary>The field names every record shares, and the names of the event fields.</summary>
public static class FieldNames
{
    public const string EventName = "event.name";
    public const string EventKind = "event.kind";
    public const string CustomEventName = "microsoft.custom_event.name";

    public const string UserId = "user.id";
    public const string UserUpn = "user.upn";
    public const string ClientApp = "client.app";
    public const string ClientVersion = "client.version";
    public const string ClientSession = "client.session";
    public const string ServiceVersion = "service.version";
    public const string Environment = "environment";

    public const string ChatId = "chat.id";
    public const string ChatTitle = "chat.title";
    public const string MessageId = "message.id";
    public const string ModelId = "model.id";
    public const string AssistantId = "assistant.id";
    public const string AssistantName = "assistant.name";
    public const string ToolId = "tool.id";
    public const string ToolName = "tool.name";
    public const string FileId = "file.id";
    public const string FileName = "file.name";
    public const string FileType = "file.type";
    public const string FileBytes = "file.bytes";
    public const string DurationMs = "duration_ms";
    public const string TokensInput = "tokens.input";
    public const string TokensOutput = "tokens.output";
    public const string TokensCached = "tokens.cached";
    public const string TokensCacheWrite = "tokens.cache_write";
    public const string Outcome = "outcome";
    public const string ErrorCategory = "error.category";
    public const string ErrorCode = "error.code";
}

/// <summary>The values of <see cref="FieldNames.Outcome"/>.</summary>
public static class Outcomes
{
    public const string Succeeded = "succeeded";
    public const string Failed = "failed";
    public const string Cancelled = "cancelled";
}

/// <summary>The values of <see cref="FieldNames.ErrorCategory"/>.</summary>
public static class ErrorCategories
{
    public const string ProviderRateLimited = "provider_rate_limited";
    public const string ProviderRefused = "provider_refused";
    public const string ProviderBadRequest = "provider_bad_request";
    public const string ProviderUnavailable = "provider_unavailable";
    public const string Timeout = "timeout";
    public const string Auth = "auth";
    public const string Config = "config";
    public const string Database = "database";
    public const string Validation = "validation";
    public const string Internal = "internal";
}

/// <summary>The values of <see cref="FieldNames.EventKind"/>.</summary>
public enum EventKind
{
    Usage,
    Audit,
    Error,
    Operational
}
