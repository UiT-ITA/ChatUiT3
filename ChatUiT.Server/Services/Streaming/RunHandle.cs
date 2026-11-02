namespace ChatUiT.Server.Services.Streaming;

/// <summary>
/// The token source driving one background run, whether the user cancelled it, and whether a
/// cancel undoes the send that started it.
/// </summary>
public sealed class RunHandle
{
    public required CancellationTokenSource Cts { get; init; }
    public bool UndoesSend { get; init; }
    public volatile bool UserCancelled;
}
