namespace ChatUiT.Server.Services.Files;

public sealed record BlobEntry(string Name, IReadOnlyDictionary<string, string> Metadata);

/// <summary>An open blob. Disposing it closes the stream.</summary>
public sealed class BlobContent(Stream stream, IReadOnlyDictionary<string, string> metadata, long length) : IAsyncDisposable
{
    public Stream Stream { get; } = stream;
    public IReadOnlyDictionary<string, string> Metadata { get; } = metadata;
    public long Length { get; } = length;

    public ValueTask DisposeAsync() => Stream.DisposeAsync();
}

/// <summary>The blob operations the file store needs. A missing container reads as empty.</summary>
public interface IBlobStorage
{
    Task EnsureContainerAsync(string container, CancellationToken cancellationToken);

    /// <summary>Creates an empty blob. False when the name is taken.</summary>
    Task<bool> TryCreateEmptyAsync(string container, string name, CancellationToken cancellationToken);

    /// <summary>A stream that replaces the blob when it is disposed.</summary>
    Task<Stream> OpenWriteAsync(string container, string name, IDictionary<string, string> metadata, CancellationToken cancellationToken);

    /// <summary>Null when the blob does not exist.</summary>
    Task<BlobContent?> OpenReadAsync(string container, string name, CancellationToken cancellationToken);

    IAsyncEnumerable<BlobEntry> ListAsync(string container, string prefix, CancellationToken cancellationToken);

    Task DeleteAsync(string container, string name, CancellationToken cancellationToken);

    Task DeleteContainerAsync(string container, CancellationToken cancellationToken);
}
