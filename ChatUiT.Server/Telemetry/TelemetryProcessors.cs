using System.Diagnostics;
using System.Reflection;
using OpenTelemetry;
using OpenTelemetry.Logs;

namespace ChatUiT.Server.Telemetry;

/// <summary>
/// Runs on every log record before export: removes exception messages that may hold content
/// (<see cref="ExceptionRedaction"/>) and adds <see cref="FieldNames.ServiceVersion"/> and
/// <see cref="FieldNames.Environment"/>.
/// </summary>
public sealed class TelemetryLogProcessor : BaseProcessor<LogRecord>
{
    private readonly string _serviceVersion;
    private readonly string _environment;

    public TelemetryLogProcessor(string serviceVersion, string environment)
    {
        _serviceVersion = serviceVersion;
        _environment = environment;
    }

    public override void OnEnd(LogRecord data)
    {
        data.Exception = ExceptionRedaction.Redact(data.Exception);

        var attributes = new List<KeyValuePair<string, object?>>((data.Attributes?.Count ?? 0) + 2);
        if (data.Attributes != null)
        {
            attributes.AddRange(data.Attributes);
        }

        attributes.Add(new(FieldNames.ServiceVersion, _serviceVersion));
        attributes.Add(new(FieldNames.Environment, _environment));
        data.Attributes = attributes;
    }
}

/// <summary>
/// Runs on every activity before export: removes the <c>access_token</c> query parameter from
/// incoming URLs, removes the query string from Microsoft Graph URLs, clears error status
/// descriptions, removes the message from exception events (keeping type and stack frames), and
/// adds <see cref="FieldNames.ServiceVersion"/> and <see cref="FieldNames.Environment"/>.
/// </summary>
public sealed class TelemetryActivityProcessor : BaseProcessor<Activity>
{
    public const string GraphHost = "graph.microsoft.com";

    private readonly string _serviceVersion;
    private readonly string _environment;

    public TelemetryActivityProcessor(string serviceVersion, string environment)
    {
        _serviceVersion = serviceVersion;
        _environment = environment;
    }

    public override void OnEnd(Activity data)
    {
        data.SetTag(FieldNames.ServiceVersion, _serviceVersion);
        data.SetTag(FieldNames.Environment, _environment);

        if (data.Kind == ActivityKind.Server)
        {
            ReplaceTag(data, "url.query", query => TelemetryUrls.RemoveQueryParameter(query, "access_token"));
            ReplaceTag(data, "url.full", url => TelemetryUrls.RemoveQueryParameter(url, "access_token"));
        }
        else if (data.Kind == ActivityKind.Client && IsGraph(data))
        {
            ReplaceTag(data, "url.full", TelemetryUrls.RemoveQuery);
            if (data.GetTagItem("url.query") != null)
            {
                data.SetTag("url.query", null);
            }
        }

        if (data.Status == ActivityStatusCode.Error && !string.IsNullOrEmpty(data.StatusDescription))
        {
            data.SetStatus(ActivityStatusCode.Error);
        }

        foreach (var activityEvent in data.Events)
        {
            if (activityEvent.Name == "exception")
            {
                RedactExceptionEvent(activityEvent);
            }
        }
    }

    private static readonly FieldInfo? EventTagsField =
        typeof(ActivityEvent).GetField("_tags", BindingFlags.Instance | BindingFlags.NonPublic);

    /// <summary>
    /// Replaces <c>exception.message</c> with <see cref="ExceptionRedaction.RemovedMessage"/> and keeps
    /// only the stack frame lines of <c>exception.stacktrace</c>. The event's tag list is changed in place.
    /// </summary>
    public static void RedactExceptionEvent(ActivityEvent activityEvent)
    {
        var current = activityEvent.Tags.ToList();
        var type = current.FirstOrDefault(tag => tag.Key == "exception.type").Value as string;
        var changes = new List<KeyValuePair<string, object?>>();

        if (current.Any(tag => tag.Key == "exception.message"))
        {
            changes.Add(new("exception.message", ExceptionRedaction.RemovedMessage));
        }

        if (current.FirstOrDefault(tag => tag.Key == "exception.stacktrace").Value is string stack)
        {
            var frames = stack.Split('\n')
                .Select(line => line.TrimEnd('\r'))
                .Where(line => line.TrimStart().StartsWith("at ", StringComparison.Ordinal)
                    || line.TrimStart().StartsWith("--- End of", StringComparison.Ordinal));
            changes.Add(new("exception.stacktrace", $"{type}: {ExceptionRedaction.RemovedMessage}\n{string.Join('\n', frames)}"));
        }

        if (changes.Count == 0)
        {
            return;
        }

        if (activityEvent.Tags is ActivityTagsCollection collection)
        {
            foreach (var (key, value) in changes)
            {
                collection[key] = value;
            }

            return;
        }

        var tagList = EventTagsField?.GetValue(activityEvent);
        var set = tagList?.GetType().GetMethod("Set", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic, [typeof(KeyValuePair<string, object?>)]);
        foreach (var change in changes)
        {
            set?.Invoke(tagList, [change]);
        }
    }

    private static bool IsGraph(Activity activity)
    {
        if (activity.GetTagItem("server.address") is string host)
        {
            return host.Equals(GraphHost, StringComparison.OrdinalIgnoreCase);
        }

        return activity.GetTagItem("url.full") is string url
            && Uri.TryCreate(url, UriKind.Absolute, out var uri)
            && uri.Host.Equals(GraphHost, StringComparison.OrdinalIgnoreCase);
    }

    private static void ReplaceTag(Activity activity, string key, Func<string, string> change)
    {
        if (activity.GetTagItem(key) is string value && value.Length > 0)
        {
            var changed = change(value);
            if (!ReferenceEquals(changed, value) && changed != value)
            {
                activity.SetTag(key, changed);
            }
        }
    }
}

/// <summary>URL changes used on telemetry.</summary>
public static class TelemetryUrls
{
    /// <summary>The URL or query string without its query string.</summary>
    public static string RemoveQuery(string url)
    {
        var index = url.IndexOf('?');
        return index < 0 ? url : url[..index];
    }

    /// <summary>
    /// The URL or query string (with or without its leading <c>?</c>) without every occurrence of
    /// the parameter <paramref name="name"/>.
    /// </summary>
    public static string RemoveQueryParameter(string value, string name)
    {
        var index = value.IndexOf('?');
        if (index < 0 && value.Contains("://", StringComparison.Ordinal))
        {
            return value;
        }

        var head = index < 0 ? string.Empty : value[..(index + 1)];
        var query = index < 0 ? value : value[(index + 1)..];
        var parts = query.Split('&', StringSplitOptions.RemoveEmptyEntries);
        var kept = parts
            .Where(part => !Uri.UnescapeDataString(part.Split('=', 2)[0]).Equals(name, StringComparison.OrdinalIgnoreCase))
            .ToArray();

        if (kept.Length == parts.Length)
        {
            return value;
        }

        if (kept.Length == 0)
        {
            return index < 0 ? string.Empty : value[..index];
        }

        return head + string.Join('&', kept);
    }
}

/// <summary>Marks outgoing requests that are not recorded as dependencies.</summary>
public static class TelemetryHttp
{
    /// <summary>Set on a request whose URL is a tool argument, so no dependency is recorded for it.</summary>
    public static readonly HttpRequestOptionsKey<bool> Untracked = new("chatuit.telemetry.untracked");

    public static bool IsTracked(HttpRequestMessage request) =>
        !(request.Options.TryGetValue(Untracked, out var untracked) && untracked);
}
