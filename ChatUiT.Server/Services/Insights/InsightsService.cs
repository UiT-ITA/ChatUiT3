using System.Collections.Concurrent;
using ChatUiT.Server.Models.Insights;
using Microsoft.Extensions.Caching.Memory;

namespace ChatUiT.Server.Services.Insights;

/// <summary>The query results of one Insights page.</summary>
public interface IInsightsService
{
    /// <summary>Runs every query of the page over the range, or returns the cached results.</summary>
    Task<InsightsPageDto> GetPageAsync(string page, InsightsRange range, CancellationToken cancellationToken);
}

/// <summary>
/// Runs the queries of a page in parallel, once at a time per page and range: requests that arrive
/// while a run is in flight wait for that run. Caches the page for <see cref="CacheDuration"/>, or
/// for <see cref="FailureCacheDuration"/> when a query failed.
/// </summary>
public sealed class InsightsService : IInsightsService
{
    public static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan FailureCacheDuration = TimeSpan.FromSeconds(30);

    private readonly IInsightsQueryRunner _runner;
    private readonly IMemoryCache _cache;
    private readonly TimeProvider _time;
    private readonly ConcurrentDictionary<string, Lazy<Task<InsightsPageDto>>> _running = new();

    public InsightsService(IInsightsQueryRunner runner, IMemoryCache cache, TimeProvider time)
    {
        _runner = runner;
        _cache = cache;
        _time = time;
    }

    public Task<InsightsPageDto> GetPageAsync(string page, InsightsRange range, CancellationToken cancellationToken)
    {
        var key = $"insights:{page.ToLowerInvariant()}:{range.Key}";
        if (_cache.TryGetValue(key, out InsightsPageDto? cached) && cached != null)
        {
            return Task.FromResult(cached);
        }

        var run = _running.GetOrAdd(key, _ =>
        {
            Lazy<Task<InsightsPageDto>>? created = null;
            created = new Lazy<Task<InsightsPageDto>>(async () =>
            {
                try
                {
                    return await RunPageAsync(page, range, key);
                }
                finally
                {
                    _running.TryRemove(new KeyValuePair<string, Lazy<Task<InsightsPageDto>>>(key, created!));
                }
            });
            return created;
        });

        return run.Value.WaitAsync(cancellationToken);
    }

    // Runs every query of the page without cancellation and caches the page.
    private async Task<InsightsPageDto> RunPageAsync(string page, InsightsRange range, string key)
    {
        var prelude = InsightsQueries.Prelude(range);
        var results = await Task.WhenAll(InsightsQueries.Pages[page].Select(async query =>
            (query.Key, Table: await _runner.RunAsync(prelude + query.Value, range.Duration, CancellationToken.None))));

        var result = new InsightsPageDto
        {
            Page = page.ToLowerInvariant(),
            Range = range.Key,
            GeneratedAt = _time.GetUtcNow(),
            Tables = results.ToDictionary(item => item.Key, item => item.Table)
        };

        _cache.Set(key, result, results.All(item => item.Table.Error == null) ? CacheDuration : FailureCacheDuration);
        return result;
    }
}
