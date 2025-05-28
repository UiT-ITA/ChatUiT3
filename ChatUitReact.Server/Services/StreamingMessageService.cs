using System.Collections.Concurrent;
using System.Text;
using Microsoft.Extensions.Logging;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public class StreamingMessageService
{
    private readonly ILogger<StreamingMessageService> _logger;
    private readonly ConcurrentDictionary<string, StreamingMessage> _activeStreams = new();
    private readonly ConcurrentDictionary<string, CancellationTokenSource> _clientCancellations = new();

    public StreamingMessageService(ILogger<StreamingMessageService> logger)
    {
        _logger = logger;
    }

    public void StartStream(string userId, string chatId, string messageId, IAsyncEnumerable<string> chunks)
    {
        var streamKey = GetStreamKey(userId, chatId, messageId);
        var streamingMessage = new StreamingMessage(userId, chatId, messageId);
        
        _activeStreams[streamKey] = streamingMessage;
        
        _ = Task.Run(async () =>
        {
            try
            {
                await foreach (var chunk in chunks)
                {
                    streamingMessage.AppendChunk(chunk);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing stream for {StreamKey}", streamKey);
            }
            finally
            {
                _activeStreams.TryRemove(streamKey, out _);
            }
        });
    }

    public async Task StreamToClient(string clientId, string userId, string chatId, string messageId, 
        Func<string, string, string, Task> sendChunk)
    {
        var streamKey = GetStreamKey(userId, chatId, messageId);
        var clientKey = $"{clientId}:{streamKey}";
        
        // Cancel any existing stream for this client
        CancelClientStream(clientId);
        
        // Create new cancellation token
        var cts = new CancellationTokenSource();
        _clientCancellations[clientKey] = cts;
        
        if (!_activeStreams.TryGetValue(streamKey, out var streamingMessage))
        {
            _clientCancellations.TryRemove(clientKey, out _);
            return;
        }

        try
        {
            await foreach (var chunk in streamingMessage.GetChunks().WithCancellation(cts.Token))
            {
                await sendChunk(chatId, messageId, chunk);
            }
        }
        catch (OperationCanceledException)
        {
            // Expected when cancelled
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error streaming to client {ClientId}", clientId);
        }
        finally
        {
            _clientCancellations.TryRemove(clientKey, out _);
        }
    }

    public void CancelClientStream(string clientId)
    {
        var keysToRemove = _clientCancellations.Keys
            .Where(key => key.StartsWith(clientId + ":"))
            .ToList();
            
        foreach (var key in keysToRemove)
        {
            if (_clientCancellations.TryRemove(key, out var cts))
            {
                cts.Cancel();
            }
        }
    }

    private static string GetStreamKey(string userId, string chatId, string messageId) => 
        $"{userId}:{chatId}:{messageId}";
}

public class StreamingMessage
{
    private readonly StringBuilder _content = new();
    private readonly List<string> _chunks = new();
    private readonly object _lock = new();
    private bool _isComplete = false;

    public string UserId { get; }
    public string ChatId { get; }
    public string MessageId { get; }

    public StreamingMessage(string userId, string chatId, string messageId)
    {
        UserId = userId;
        ChatId = chatId;
        MessageId = messageId;
    }

    public void AppendChunk(string chunk)
    {
        lock (_lock)
        {
            if (!_isComplete)
            {
                _content.Append(chunk);
                _chunks.Add(chunk);
            }
        }
    }

    public void Complete()
    {
        lock (_lock)
        {
            _isComplete = true;
        }
    }

    public async IAsyncEnumerable<string> GetChunks()
    {
        var index = 0;
        
        while (true)
        {
            string? chunk = null;
            bool complete;
            
            lock (_lock)
            {
                if (index < _chunks.Count)
                {
                    chunk = _chunks[index++];
                }
                complete = _isComplete;
            }
            
            if (chunk != null)
            {
                yield return chunk;
            }
            else if (complete)
            {
                break;
            }
            else
            {
                await Task.Delay(10); // Small delay before checking again
            }
        }
    }
}
