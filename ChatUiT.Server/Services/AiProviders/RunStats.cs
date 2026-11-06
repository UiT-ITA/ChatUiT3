using System.Diagnostics;

namespace ChatUiT.Server.Services.AiProviders;

/// <summary>
/// What one run of a message used, summed over its model turns, for <c>generation.finished</c>.
/// The run's clock starts when the object is created.
/// </summary>
public sealed class RunStats
{
    private readonly Stopwatch _stopwatch = Stopwatch.StartNew();

    public int ModelTurns { get; private set; }

    public long InputTokens { get; private set; }

    public long OutputTokens { get; private set; }

    public long CachedTokens { get; private set; }

    public long CacheWriteTokens { get; private set; }

    /// <summary>The last turn's stop reason, or <c>tool_round_limit</c> when the run hit the round cap.</summary>
    public string? StopReason { get; set; }

    /// <summary>Milliseconds from the start of the run to its first answer text. Null when there was none.</summary>
    public long? TimeToFirstTokenMs { get; private set; }

    public long ElapsedMs => _stopwatch.ElapsedMilliseconds;

    public void Add(AiStreamEvent.TurnEnded turn)
    {
        ModelTurns++;
        InputTokens += turn.InputTokens;
        OutputTokens += turn.OutputTokens;
        CachedTokens += turn.CachedTokens;
        CacheWriteTokens += turn.CacheWriteTokens;
        if (StopReason != "tool_round_limit")
        {
            StopReason = turn.StopReason;
        }
    }

    public void FirstText() => TimeToFirstTokenMs ??= _stopwatch.ElapsedMilliseconds;
}
