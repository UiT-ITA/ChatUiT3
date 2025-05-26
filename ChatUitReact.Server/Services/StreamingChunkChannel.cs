using System.Runtime.CompilerServices;
using System.Threading.Channels;

namespace ChatUitReact.Server.Services;

public class StreamingChunkChannel
{
    private readonly Channel<string> _channel;
    private bool _isComplete;
    
    public StreamingChunkChannel()
    {
        _channel = Channel.CreateUnbounded<string>();
        _isComplete = false;
    }
    
    public async Task WriteChunk(string chunk)
    {
        if (!_isComplete && !string.IsNullOrEmpty(chunk))
        {
            await _channel.Writer.WriteAsync(chunk);
        }
    }
    
    public void Complete()
    {
        _isComplete = true;
        _channel.Writer.Complete();
    }
    
    public bool IsComplete => _isComplete;
    
    public async IAsyncEnumerable<string> ReadAllChunks([EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        while (await _channel.Reader.WaitToReadAsync(cancellationToken).ConfigureAwait(false))
        {
            while (_channel.Reader.TryRead(out var chunk))
            {
                yield return chunk;
            }
        }
    }
}
