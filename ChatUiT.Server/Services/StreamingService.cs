using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.SignalR;
using ChatUiT.Server.Hubs;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Streaming;

namespace ChatUiT.Server.Services;

public class StreamingService
{
    private readonly Telemetry.AppTelemetry _telemetry;
    private readonly IHubContext<AppHub, IAppHubClient> _hubContext;
    private readonly ConcurrentDictionary<string, LiveStream<ChatStreamChunk>> _activeStreams = new();
    private readonly ConcurrentDictionary<string, RunHandle> _activeGenerations = new();

    public StreamingService(Telemetry.AppTelemetry telemetry, IHubContext<AppHub, IAppHubClient> hubContext)
    {
        _telemetry = telemetry;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Registers the token source driving a generation so it can be cancelled from another request.
    /// Ownership (disposal) stays with the caller.
    /// </summary>
    /// <param name="undoesSend">True when a cancel removes the send that started the run; false for a message that continues.</param>
    public void RegisterGeneration(string userId, string messageId, CancellationTokenSource cancellationTokenSource, TimeSpan timeout, bool undoesSend)
    {
        var handle = new RunHandle { Cts = cancellationTokenSource, UndoesSend = undoesSend };
        cancellationTokenSource.CancelAfter(timeout);
        _activeGenerations[GetStreamKey(userId, messageId)] = handle;
    }

    /// <summary>
    /// Cancels a running generation on the user's behalf. False when nothing is running — the
    /// generation already finished, or the message belongs to someone else (the key embeds the user).
    /// <paramref name="undoesSend"/> says whether the cancel removes the send.
    /// </summary>
    public bool TryCancelGeneration(string userId, string messageId, out bool undoesSend)
    {
        undoesSend = false;
        if (!_activeGenerations.TryGetValue(GetStreamKey(userId, messageId), out var handle))
        {
            return false;
        }

        undoesSend = handle.UndoesSend;

        // Flag before cancelling: the generation task reads it the moment the token fires.
        handle.UserCancelled = true;

        try
        {
            handle.Cts.Cancel();
        }
        catch (ObjectDisposedException)
        {
            return false;
        }

        return true;
    }

    /// <summary>
    /// Distinguishes a user-requested cancel from the generation timeout, which fires the same token.
    /// </summary>
    public bool WasCancelledByUser(string userId, string messageId)
    {
        return _activeGenerations.TryGetValue(GetStreamKey(userId, messageId), out var handle) && handle.UserCancelled;
    }

    public void UnregisterGeneration(string userId, string messageId)
    {
        _activeGenerations.TryRemove(GetStreamKey(userId, messageId), out _);
    }

    public bool IsGenerationActive(string userId, string messageId)
        => _activeGenerations.ContainsKey(GetStreamKey(userId, messageId));

    public void StartMessage(string userId, string messageId)
    {
        var streamKey = GetStreamKey(userId, messageId);
        var stream = new LiveStream<ChatStreamChunk>();
        _activeStreams[streamKey] = stream;
        
        // Auto-cleanup after completion + delay
        _ = Task.Run(async () =>
        {
            while (!stream.IsComplete)
            {
                await Task.Delay(1000);
            }
            
            // Wait additional time for late clients
            await Task.Delay(TimeSpan.FromMinutes(5));
            
            // Removes this stream only, not a newer one a continued message started under the same key.
            if (_activeStreams.TryRemove(new KeyValuePair<string, LiveStream<ChatStreamChunk>>(streamKey, stream)))
            {
                stream.Dispose();
            }
        });
    }

    public void AddChunk(string userId, string messageId, ChatStreamChunk chunk)
    {
        var streamKey = GetStreamKey(userId, messageId);
        
        if (_activeStreams.TryGetValue(streamKey, out var stream))
        {
            stream.Publish(chunk);
        }
        else
        {
            _telemetry.StreamChunkDropped(streamKey);
        }
    }

    public void CompleteMessage(string userId, string messageId)
    {
        var streamKey = GetStreamKey(userId, messageId);
        
        if (_activeStreams.TryGetValue(streamKey, out var stream))
        {
            stream.Complete();
        }
    }

    public void StartClientStream(string clientId, string userId, string messageId)
    {
        // Fire-and-forget using our own IHubContext
        _ = Task.Run(async () =>
        {
            try
            {
                await StreamToClient(clientId, userId, messageId);
            }
            catch (Exception ex)
            {
                _telemetry.StreamClientFailed($"{userId}:{messageId}", clientId, ex);
            }
        });
    }

    private async Task StreamToClient(string clientId, string userId, string messageId)
    {
        var streamKey = GetStreamKey(userId, messageId);
        
        if (!_activeStreams.TryGetValue(streamKey, out var stream))
        {
            _telemetry.StreamMissing(streamKey);
            return;
        }

        try
        {
            await foreach (var chunk in stream.GetReader())
            {
                await _hubContext.Clients.Client(clientId).ReceiveMessageChunk(messageId, chunk);
            }
        }
        catch (Exception ex)
        {
            _telemetry.StreamClientFailed(streamKey, clientId, ex);
        }
    }

    private static string GetStreamKey(string userId, string messageId) => $"{userId}:{messageId}";
}
