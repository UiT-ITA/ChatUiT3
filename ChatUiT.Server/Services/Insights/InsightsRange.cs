namespace ChatUiT.Server.Services.Insights;

/// <summary>A time range the Insights page offers, and the bucket size of its time series.</summary>
public sealed record InsightsRange(string Key, TimeSpan Duration, TimeSpan Bucket)
{
    public const string DefaultKey = "24h";

    public static readonly IReadOnlyList<InsightsRange> All =
    [
        new("1h", TimeSpan.FromHours(1), TimeSpan.FromMinutes(5)),
        new("24h", TimeSpan.FromHours(24), TimeSpan.FromHours(1)),
        new("7d", TimeSpan.FromDays(7), TimeSpan.FromHours(6)),
        new("30d", TimeSpan.FromDays(30), TimeSpan.FromDays(1))
    ];

    /// <summary>The range with this key, or null for an unknown key.</summary>
    public static InsightsRange? Find(string? key) =>
        All.FirstOrDefault(range => string.Equals(range.Key, key ?? DefaultKey, StringComparison.OrdinalIgnoreCase));
}
