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
