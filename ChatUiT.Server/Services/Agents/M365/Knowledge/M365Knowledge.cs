using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Services.Knowledge;

namespace ChatUiT.Server.Services.Agents.M365.Knowledge;

/// <summary>Formatting and fan-out helpers shared by the Microsoft 365 knowledge sources.</summary>
internal static partial class M365Knowledge
{
    public const string Group = "Microsoft 365";

    /// <summary>Longest message or post text carried, in characters.</summary>
    public const int TextLimit = 500;

    /// <summary>Most Graph requests one source runs at the same time.</summary>
    public const int MaxParallelRequests = 4;

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    /// <summary>One line of text: whitespace collapsed, cut at <paramref name="limit"/> characters.</summary>
    public static string Clip(string? text, int limit = TextLimit)
    {
        var line = Whitespace().Replace(text ?? string.Empty, " ").Trim();
        return line.Length <= limit ? line : line[..limit].TrimEnd() + "…";
    }

    /// <summary>A Graph timestamp, read as UTC when it carries no offset; null when it does not parse.</summary>
    public static DateTimeOffset? Instant(string? value)
        => DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed)
            ? parsed
            : null;

    /// <summary>A Graph UTC timestamp in the user's time zone, or null when it does not parse.</summary>
    public static DateTimeOffset? Local(KnowledgeSourceContext context, string? utc)
        => Instant(utc) is { } instant ? context.ToLocal(instant) : null;

    public static string Time(KnowledgeSourceContext context, string? utc)
        => Local(context, utc)?.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture) ?? "unknown time";

    /// <summary>The local date of a Graph <c>dateTimeTimeZone</c>: converted when it is in UTC, taken as is otherwise.</summary>
    public static string? Date(KnowledgeSourceContext context, string? dateTime, string? timeZone)
    {
        if (string.IsNullOrWhiteSpace(dateTime))
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(timeZone) || timeZone.Equals("UTC", StringComparison.OrdinalIgnoreCase))
        {
            return Local(context, dateTime)?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }

        return DateTime.TryParse(dateTime, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)
            ? parsed.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
            : null;
    }

    /// <summary>A UTC instant as Graph expects it in <c>$filter</c> and calendar view bounds.</summary>
    public static string Iso(DateTime utc) => utc.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture);

    public static string Day(DateOnly day) => day.ToString("yyyy-MM-dd (dddd)", CultureInfo.InvariantCulture);

    public static string Sender(JsonElement message)
        => message.Str("from", "user", "displayName") ?? message.Str("from", "application", "displayName") ?? "Unknown sender";

    /// <summary>Whether Graph has another page after this one.</summary>
    public static bool HasMore(JsonElement response) => response.Str("@odata.nextLink") != null;

    /// <summary>Runs <paramref name="map"/> over every item, at most <see cref="MaxParallelRequests"/> at a time, keeping input order.</summary>
    public static async Task<TResult[]> MapLimitedAsync<T, TResult>(IEnumerable<T> items, Func<T, Task<TResult>> map, CancellationToken ct)
    {
        using var gate = new SemaphoreSlim(MaxParallelRequests);
        return await Task.WhenAll(items.Select(async item =>
        {
            await gate.WaitAsync(ct);
            try
            {
                return await map(item);
            }
            finally
            {
                gate.Release();
            }
        }));
    }
}
