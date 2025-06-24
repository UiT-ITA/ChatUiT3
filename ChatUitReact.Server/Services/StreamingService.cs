using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.SignalR;
using ChatUitReact.Server.Hubs;

namespace ChatUitReact.Server.Services;

public class StreamingService
{
    private readonly ILogger<StreamingService> _logger;
    private readonly IHubContext<ChatHub, IChatHubClient> _hubContext;
    private readonly ConcurrentDictionary<string, MessageStream> _activeStreams = new();

    public StreamingService(ILogger<StreamingService> logger, IHubContext<ChatHub, IChatHubClient> hubContext)
    {
        _logger = logger;
        _hubContext = hubContext;
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
            stream.AddChunk(chunk);
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
            var chunkIndex = 0;
            
            while (true)
            {
                // Get next chunk if available
                var chunk = stream.GetChunk(chunkIndex);
                if (chunk != null)
                {
                    await _hubContext.Clients.Client(clientId).ReceiveMessageChunk(messageId, chunk);
                    chunkIndex++;
                    continue;
                }
                
                // If stream is complete and no more chunks, exit
                if (stream.IsComplete)
                    break;
                    
                // Wait for new chunks
                await stream.WaitForNewChunk();
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error streaming to client {ClientId} for message {StreamKey}", clientId, streamKey);
        }
    }

    private static string GetStreamKey(string userId, string messageId) => $"{userId}:{messageId}";
}

internal class MessageStream : IDisposable
{
    private readonly List<string> _chunks = new();
    private readonly SemaphoreSlim _newChunkSignal = new(0);
    private readonly object _lock = new();
    private bool _isComplete = false;
    private bool _disposed = false;

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

    public void AddChunk(string chunk)
    {
        lock (_lock)
        {
            if (_isComplete || _disposed) return;
            
            _chunks.Add(chunk);
        }
        
        // Signal waiting clients
        _newChunkSignal.Release();
    }

    public void Complete()
    {
        lock (_lock)
        {
            _isComplete = true;
        }
        
        // Release all waiting clients
        _newChunkSignal.Release(1000); // Large number to release all waiting
    }

    public string? GetChunk(int index)
    {
        lock (_lock)
        {
            return index < _chunks.Count ? _chunks[index] : null;
        }
    }

    public async Task WaitForNewChunk()
    {
        if (_disposed) return;
        
        try
        {
            await _newChunkSignal.WaitAsync(TimeSpan.FromSeconds(30));
        }
        catch (ObjectDisposedException)
        {
            // Expected during cleanup
        }
    }

    public void Dispose()
    {
        _disposed = true;
        _newChunkSignal?.Dispose();
    }
}
