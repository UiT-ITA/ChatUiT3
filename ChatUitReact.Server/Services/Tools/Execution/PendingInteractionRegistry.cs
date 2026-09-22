using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services.Tools;

/// <summary>
/// Tool calls waiting for someone outside the server: the user's approval, their consent,
/// or a client's result. One entry per call, keyed by user, message and tool call id, so a
/// response can only ever complete a call that belongs to the responding user.
///
/// While a call waits, the generation deadline is suspended; the wait has its own timeout.
/// In-process only: a second server instance would not see these entries.
/// </summary>
public sealed class PendingInteractionRegistry
{
    private readonly ConcurrentDictionary<string, Pending> _pending = new();
    private readonly StreamingService _streaming;

    public PendingInteractionRegistry(StreamingService streaming)
    {
        _streaming = streaming;
    }

    /// <summary>Whether a message currently has any call waiting. Used to keep paused runs out of the stale sweep.</summary>
    public bool HasPending(string userId, string messageId)
    {
        var prefix = Key(userId, messageId, string.Empty);
        foreach (var key in _pending.Keys)
        {
            if (key.StartsWith(prefix, StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }

    public ToolCallStatus? GetPendingStatus(string userId, string messageId, string toolCallId)
        => _pending.TryGetValue(Key(userId, messageId, toolCallId), out var pending) ? pending.Awaiting : null;

    /// <summary>
    /// Waits for a response. Returns null on timeout. Throws <see cref="OperationCanceledException"/>
    /// when the generation itself is cancelled.
    /// </summary>
    public async Task<InteractionResponse?> WaitAsync(
        string userId,
        string messageId,
        string toolCallId,
        ToolCallStatus awaiting,
        TimeSpan timeout,
        CancellationToken generationToken)
    {
        var key = Key(userId, messageId, toolCallId);
        var pending = new Pending(awaiting);
        if (!_pending.TryAdd(key, pending))
        {
            throw new InvalidOperationException($"Tool call {toolCallId} is already waiting.");
        }

        _streaming.SuspendGenerationTimeout(userId, messageId);
        try
        {
            using var timeoutSource = new CancellationTokenSource(timeout);
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(generationToken, timeoutSource.Token);
            using var registration = linked.Token.Register(() => pending.Source.TrySetCanceled(linked.Token));

            try
            {
                return await pending.Source.Task.ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (timeoutSource.IsCancellationRequested && !generationToken.IsCancellationRequested)
            {
                return null;
            }
        }
        finally
        {
            _pending.TryRemove(key, out _);
            _streaming.ResumeGenerationTimeout(userId, messageId);
        }
    }

    /// <summary>False when nothing is waiting under that key: already answered, timed out, or not this user's.</summary>
    public bool TryComplete(string userId, string messageId, string toolCallId, InteractionResponse response)
    {
        return _pending.TryGetValue(Key(userId, messageId, toolCallId), out var pending)
            && pending.Source.TrySetResult(response);
    }

    private static string Key(string userId, string messageId, string toolCallId) => $"{userId}:{messageId}:{toolCallId}";

    private sealed class Pending(ToolCallStatus awaiting)
    {
        public ToolCallStatus Awaiting { get; } = awaiting;

        public TaskCompletionSource<InteractionResponse> Source { get; } =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
    }
}
