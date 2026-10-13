using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using Microsoft.Extensions.Logging;

namespace ChatUitReact.Server.Services.Knowledge;

/// <summary>
/// Loads an assistant's knowledge sources and turns each into a synthetic user message that
/// leads the history after the knowledge files. Sources load in parallel under one deadline. A
/// source that fails or misses the deadline is carried as "not available" so the model knows
/// the data is missing; the reply is never blocked. The messages are never persisted or shown
/// to the client.
/// </summary>
public static class KnowledgeSourceMessages
{
    public static readonly TimeSpan Timeout = TimeSpan.FromSeconds(15);

    /// <summary>Used when the client sends no time zone or one this server does not know.</summary>
    public const string DefaultTimeZoneId = "Europe/Oslo";

    public static TimeZoneInfo ResolveTimeZone(string? id)
        => !string.IsNullOrWhiteSpace(id) && TimeZoneInfo.TryFindSystemTimeZoneById(id.Trim(), out var zone)
            ? zone
            : TimeZoneInfo.FindSystemTimeZoneById(DefaultTimeZoneId);

    public static async Task<List<ChatMessage>> BuildAsync(
        IReadOnlyList<IKnowledgeSource> sources,
        KnowledgeSourceContext context,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        if (sources.Count == 0)
        {
            return [];
        }

        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(Timeout);

        var texts = await Task.WhenAll(sources.Select(source => LoadAsync(source, context, logger, deadline.Token)));

        var asOf = $"{context.LocalNow:yyyy-MM-dd HH:mm} ({context.TimeZone.Id})";
        return sources
            .Zip(texts, (source, text) => text == null ? null : For(source, text, asOf))
            .OfType<ChatMessage>()
            .ToList();
    }

    private static ChatMessage For(IKnowledgeSource source, string text, string asOf) => new()
    {
        Role = AiChatRole.User,
        Content = $"Live data from {source.DisplayName}, as of {asOf}. Background knowledge; it is not a question.\n\n{text}",
        Status = AiChatStatus.Success
    };

    private static async Task<string?> LoadAsync(IKnowledgeSource source, KnowledgeSourceContext context, ILogger logger, CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            var text = await source.LoadAsync(context, cancellationToken);
            logger.LogInformation("Knowledge source {SourceId} loaded in {ElapsedMs} ms ({Length} chars)", source.Id, stopwatch.ElapsedMilliseconds, text?.Length ?? 0);
            return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Knowledge source {SourceId} failed after {ElapsedMs} ms", source.Id, stopwatch.ElapsedMilliseconds);
            return $"{source.DisplayName}: not available.";
        }
    }
}
