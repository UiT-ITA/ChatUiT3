namespace ChatUiT.Server.Services.Streaming;

/// <summary>
/// The token source driving one background run, its deadline, and whether the user cancelled
/// it. The deadline can be paused and restarted.
/// </summary>
public sealed class RunHandle
{
    public required CancellationTokenSource Cts { get; init; }
    public required TimeSpan Timeout { get; init; }
    public volatile bool UserCancelled;

    public void Suspend()
    {
        try
        {
            Cts.CancelAfter(System.Threading.Timeout.InfiniteTimeSpan);
        }
        catch (ObjectDisposedException)
        {
        }
    }

    /// <summary>Restarts the full deadline: the run gets its whole budget again after a pause.</summary>
    public void Resume()
    {
        try
        {
            Cts.CancelAfter(Timeout);
        }
        catch (ObjectDisposedException)
        {
        }
    }
}
