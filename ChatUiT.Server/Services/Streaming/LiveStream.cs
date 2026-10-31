using System.Threading.Channels;

namespace ChatUiT.Server.Services.Streaming;

/// <summary>
/// The events of one background run, kept in order. Every reader gets all events published
/// so far, then each new one, until the run completes.
/// </summary>
public sealed class LiveStream<TEvent> : IDisposable
{
    private readonly List<TEvent> _buffer = new();
    private readonly List<Channel<TEvent>> _channels = new();
    private readonly object _lock = new();
    private bool _isComplete = false;

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

    public void Publish(TEvent item)
    {
        lock (_lock)
        {
            if (_isComplete) return;
            
            _buffer.Add(item);
            foreach (var channel in _channels)
            {
                channel.Writer.TryWrite(item);
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

    public IAsyncEnumerable<TEvent> GetReader()
    {
        var channel = Channel.CreateUnbounded<TEvent>();
        lock (_lock)
        {
            // Replay all existing events to new reader
            foreach (var item in _buffer)
            {
                channel.Writer.TryWrite(item);
            }
            
            // If already complete, close this channel too
            if (_isComplete)
            {
                channel.Writer.TryComplete();
            }
            else
            {
                // Add to active channels for future events
                _channels.Add(channel);
            }
        }

        return ReadAll(channel.Reader);
    }

    private async IAsyncEnumerable<TEvent> ReadAll(ChannelReader<TEvent> reader)
    {
        while (await reader.WaitToReadAsync())
        {
            while (reader.TryRead(out var item))
            {
                yield return item;
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
