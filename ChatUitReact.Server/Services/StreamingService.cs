using System.Collections.Concurrent;
using System.Threading.Channels;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.SignalR;
using ChatUitReact.Server.Hubs;

namespace ChatUitReact.Server.Services;

public class StreamingService
{
    private readonly ILogger<StreamingService> _logger;
    private readonly IHubContext<ChatHub, IChatHubClient> _hubContext;
    private readonly ConcurrentDictionary<string, MessageStream> _activeStreams = new();
    private readonly ConcurrentDictionary<string, GenerationHandle> _activeGenerations = new();

    public StreamingService(ILogger<StreamingService> logger, IHubContext<ChatHub, IChatHubClient> hubContext)
    {
        _logger = logger;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Registers the token source driving a generation so it can be cancelled from another request.
    /// Ownership (disposal) stays with the caller.
    /// </summary>
    public void RegisterGeneration(string userId, string messageId, CancellationTokenSource cancellationTokenSource)
    {
        _activeGenerations[GetStreamKey(userId, messageId)] = new GenerationHandle { Cts = cancellationTokenSource };
    }

    /// <summary>
    /// Cancels a running generation on the user's behalf. False when nothing is running — the
    /// generation already finished, or the message belongs to someone else (the key embeds the user).
    /// </summary>
    public bool TryCancelGeneration(string userId, string messageId)
    {
        if (!_activeGenerations.TryGetValue(GetStreamKey(userId, messageId), out var handle))
        {
            return false;
        }

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

    public void StartMessage(string userId, string messageId)
    {
        var streamKey = GetStreamKey(userId, messageId);
        var stream = new MessageStream(userId, messageId);
        _activeStreams[streamKey] = stream;
        
        // Auto-cleanup after completion + delay
        _ = Task.Run(async () =>
        {
            // Wait for completion
            while (!stream.IsComplete)
            {
                await Task.Delay(1000);
            }
            
            // Wait additional time for late clients
            await Task.Delay(TimeSpan.FromMinutes(5));
            
            // Cleanup
            if (_activeStreams.TryRemove(streamKey, out var removedStream))
            {
                removedStream.Dispose();
            }
        });
    }

    public void AddChunk(string userId, string messageId, string chunk)
    {
        var streamKey = GetStreamKey(userId, messageId);
        
        if (_activeStreams.TryGetValue(streamKey, out var stream))
        {
            stream.Publish(chunk);
        }
        else
        {
            _logger.LogWarning("Attempted to add chunk to non-existent stream: {StreamKey}", streamKey);
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
                _logger.LogError(ex, "Error streaming to client {ClientId} for message {UserId}:{MessageId}", clientId, userId, messageId);
            }
        });
    }

    private async Task StreamToClient(string clientId, string userId, string messageId)
    {
        var streamKey = GetStreamKey(userId, messageId);
        
        if (!_activeStreams.TryGetValue(streamKey, out var stream))
        {
            _logger.LogWarning("Client requested stream for non-existent message: {StreamKey}", streamKey);
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
            _logger.LogError(ex, "Error streaming to client {ClientId} for message {StreamKey}", clientId, streamKey);
        }
    }

    private static string GetStreamKey(string userId, string messageId) => $"{userId}:{messageId}";

    private sealed class GenerationHandle
    {
        public required CancellationTokenSource Cts { get; init; }
        public volatile bool UserCancelled;
    }
}

internal class MessageStream : IDisposable
{
    private readonly List<string> _buffer = new();
    private readonly List<Channel<string>> _channels = new();
    private readonly object _lock = new();
    private bool _isComplete = false;

    public string UserId { get; }
    public string MessageId { get; }

    public MessageStream(string userId, string messageId)
    {
        UserId = userId;
        MessageId = messageId;
    }

    public bool IsComplete
    {
        get
        {
            lock (_lock)
            {
                return _isComplete;
            }
        }
    }

    public void Publish(string chunk)
    {
        lock (_lock)
        {
            if (_isComplete) return;
            
            _buffer.Add(chunk);
            foreach (var channel in _channels)
            {
                channel.Writer.TryWrite(chunk);
            }
        }
    }

    public void Complete()
    {
        lock (_lock)
        {
            _isComplete = true;
            foreach (var channel in _channels)
            {
                channel.Writer.TryComplete();
            }
        }
    }

    public IAsyncEnumerable<string> GetReader()
    {
        var channel = Channel.CreateUnbounded<string>();
        lock (_lock)
        {
            // Replay all existing chunks to new reader
            foreach (var chunk in _buffer)
            {
                channel.Writer.TryWrite(chunk);
            }
            
            // If already complete, close this channel too
            if (_isComplete)
            {
                channel.Writer.TryComplete();
            }
            else
            {
                // Add to active channels for future chunks
                _channels.Add(channel);
            }
        }

        return ReadAll(channel.Reader);
    }

    private async IAsyncEnumerable<string> ReadAll(ChannelReader<string> reader)
    {
        while (await reader.WaitToReadAsync())
        {
            while (reader.TryRead(out var chunk))
            {
                yield return chunk;
            }
        }
    }

    public void Dispose()
    {
        lock (_lock)
        {
            foreach (var channel in _channels)
            {
                channel.Writer.TryComplete();
            }
            _channels.Clear();
        }
    }
}
