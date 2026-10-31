using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;

namespace ChatUiT.Server.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum MediaGenerationStatus
{
    Running,
    Completed,
    /// <summary>The run failed; its partial outputs are gone and must no longer be shown.</summary>
    Failed,
    Cancelled
}

/// <summary>
/// One run of a generation model (image, voice) for a user: what was asked, how it went, and
/// what it produced. The run updates it while other requests read it, so outputs and the
/// outcome change only through its methods.
/// </summary>
public sealed class MediaGeneration
{
    private readonly object _lock = new();
    private readonly List<MediaOutput> _outputs = new();

    public string Id { get; } = Guid.NewGuid().ToString();
    public required string UserId { get; init; }

    /// <summary>The type of the model that runs it.</summary>
    public required ModelType Type { get; init; }

    /// <summary>The model row's id.</summary>
    public required string ModelId { get; init; }
    public required string ModelName { get; init; }
    public required string Prompt { get; init; }
    public DateTime CreatedAt { get; } = DateTime.UtcNow;

    public MediaGenerationStatus Status { get; private set; } = MediaGenerationStatus.Running;
    public string? Error { get; private set; }
    public DateTime? FinishedAt { get; private set; }
    public int? InputTokens { get; private set; }
    public int? OutputTokens { get; private set; }

    public IReadOnlyList<MediaOutput> Outputs
    {
        get
        {
            lock (_lock)
            {
                return _outputs.ToList();
            }
        }
    }

    public MediaOutput? FindOutput(string outputId)
    {
        lock (_lock)
        {
            return _outputs.FirstOrDefault(o => o.Id == outputId);
        }
    }

    public MediaOutput AddOutput(int index, int? partialIndex, string mediaType, byte[] content)
    {
        var output = new MediaOutput
        {
            Index = index,
            PartialIndex = partialIndex,
            MediaType = mediaType,
            Content = content
        };

        lock (_lock)
        {
            _outputs.Add(output);
        }

        return output;
    }

    /// <summary>Adds the tokens of one usage report to the totals.</summary>
    public void AddUsage(int inputTokens, int outputTokens)
    {
        lock (_lock)
        {
            InputTokens = (InputTokens ?? 0) + inputTokens;
            OutputTokens = (OutputTokens ?? 0) + outputTokens;
        }
    }

    /// <summary>Ends the run. A failed run keeps none of its partial outputs.</summary>
    public void Finish(MediaGenerationStatus status, string? error = null)
    {
        lock (_lock)
        {
            Status = status;
            Error = error;
            FinishedAt = DateTime.UtcNow;
            if (status == MediaGenerationStatus.Failed)
            {
                _outputs.RemoveAll(o => o.PartialIndex != null);
            }
        }
    }
}

/// <summary>
/// One file a generation produced. <see cref="PartialIndex"/> is set on an unfinished version
/// streamed before output <see cref="Index"/> was done.
/// </summary>
public sealed class MediaOutput
{
    public string Id { get; } = Guid.NewGuid().ToString();
    public required int Index { get; init; }
    public int? PartialIndex { get; init; }
    public required string MediaType { get; init; }
    public required byte[] Content { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum MediaGenerationEventKind
{
    /// <summary>An unfinished version of an output is ready to download.</summary>
    PartialOutput,
    /// <summary>A finished output is ready to download.</summary>
    Output,
    /// <summary>The token totals changed.</summary>
    Usage,
    Completed,
    /// <summary>The run failed; its partial outputs are gone and must no longer be shown.</summary>
    Failed,
    Cancelled
}

/// <summary>
/// One event on a generation's live stream, from the run through SignalR to the client. Outputs
/// are referenced by id and downloaded separately. <see cref="ElapsedMs"/> is measured on the
/// server so replayed streams show the same timings as live ones.
/// </summary>
public sealed class MediaGenerationEvent
{
    public MediaGenerationEventKind Kind { get; init; }
    public long ElapsedMs { get; init; }
    public string? OutputId { get; init; }
    public int? OutputIndex { get; init; }
    public int? PartialIndex { get; init; }
    public string? MediaType { get; init; }
    public int? InputTokens { get; init; }
    public int? OutputTokens { get; init; }
    public string? Error { get; init; }
}
