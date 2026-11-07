using System.Text.Json;
using Azure;
using Azure.Core;
using Azure.Identity;
using Azure.Monitor.Query.Logs;
using Azure.Monitor.Query.Logs.Models;
using ChatUiT.Server.Models.Insights;
using Microsoft.Extensions.Options;

namespace ChatUiT.Server.Services.Insights;

/// <summary>Runs one KQL query against the Application Insights resource over a time span.</summary>
public interface IInsightsQueryRunner
{
    Task<InsightsTableDto> RunAsync(string query, TimeSpan duration, CancellationToken cancellationToken);
}

/// <summary>
/// Runs queries resource-centric on the configured Application Insights resource with the app's
/// <see cref="TokenCredential"/>, so only that resource's records are readable.
/// </summary>
public sealed class LogsQueryRunner : IInsightsQueryRunner
{
    private static readonly LogsQueryOptions QueryOptions = new() { ServerTimeout = TimeSpan.FromSeconds(60) };

    private readonly LogsQueryClient _client;
    private readonly ResourceIdentifier? _resourceId;
    private readonly ILogger<LogsQueryRunner> _logger;

    public LogsQueryRunner(TokenCredential credential, IOptions<InsightsOptions> options, ILogger<LogsQueryRunner> logger)
    {
        _client = new LogsQueryClient(credential);
        var resourceId = options.Value.ApplicationInsightsResourceId;
        _resourceId = string.IsNullOrWhiteSpace(resourceId) ? null : new ResourceIdentifier(resourceId);
        _logger = logger;
    }

    public async Task<InsightsTableDto> RunAsync(string query, TimeSpan duration, CancellationToken cancellationToken)
    {
        if (_resourceId == null)
        {
            return InsightsTableDto.Failed(InsightsErrors.NotConfigured);
        }

        try
        {
            Response<LogsQueryResult> response = await _client.QueryResourceAsync(_resourceId, query, new LogsQueryTimeRange(duration), QueryOptions, cancellationToken);
            return ToTable(response.Value.Table);
        }
        catch (RequestFailedException exception) when (exception.Status is 401 or 403)
        {
            _logger.LogWarning(exception, "Insights query refused with status {Status}", exception.Status);
            return InsightsTableDto.Failed(InsightsErrors.NoAccess);
        }
        catch (AuthenticationFailedException exception)
        {
            _logger.LogWarning(exception, "Insights query got no token");
            return InsightsTableDto.Failed(InsightsErrors.NoAccess);
        }
        catch (RequestFailedException exception)
        {
            _logger.LogWarning(exception, "Insights query failed with status {Status}", exception.Status);
            return InsightsTableDto.Failed(InsightsErrors.QueryFailed);
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(exception, "Insights query timed out");
            return InsightsTableDto.Failed(InsightsErrors.QueryFailed);
        }
    }

    private static InsightsTableDto ToTable(LogsTable table)
    {
        var columns = table.Columns.Select(column => new InsightsColumnDto(column.Name, column.Type.ToString())).ToList();
        var rows = table.Rows
            .Select(row => (IReadOnlyList<object?>)Enumerable.Range(0, columns.Count).Select(index => Value(row, index, table.Columns[index].Type)).ToList())
            .ToList();
        return new InsightsTableDto { Columns = columns, Rows = rows };
    }

    private static object? Value(LogsTableRow row, int index, LogsColumnType type)
    {
        var value = row[index];
        if (value == null)
        {
            return null;
        }

        if (type == LogsColumnType.Dynamic)
        {
            return JsonDocument.Parse(row.GetDynamic(index)!.ToString()).RootElement.Clone();
        }

        return value;
    }
}
