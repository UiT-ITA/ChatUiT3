namespace ChatUiT.Server.Models.Insights;

/// <summary>The results of every query of one Insights page for one time range.</summary>
public sealed class InsightsPageDto
{
    public required string Page { get; init; }
    public required string Range { get; init; }
    public required DateTimeOffset GeneratedAt { get; init; }
    public required IReadOnlyDictionary<string, InsightsTableDto> Tables { get; init; }
}

/// <summary>The result of one query: its columns and rows, or the reason it failed.</summary>
public sealed class InsightsTableDto
{
    public IReadOnlyList<InsightsColumnDto> Columns { get; init; } = [];
    public IReadOnlyList<IReadOnlyList<object?>> Rows { get; init; } = [];
    public string? Error { get; init; }

    public static InsightsTableDto Failed(string error) => new() { Error = error };
}

/// <summary>A column name and its Kusto type, such as string, long, real or datetime.</summary>
public sealed record InsightsColumnDto(string Name, string Type);

/// <summary>The values of <see cref="InsightsTableDto.Error"/>.</summary>
public static class InsightsErrors
{
    public const string NotConfigured = "not_configured";
    public const string NoAccess = "no_access";
    public const string QueryFailed = "query_failed";
}
