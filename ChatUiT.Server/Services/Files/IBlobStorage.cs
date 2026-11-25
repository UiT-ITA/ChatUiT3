namespace ChatUiT.Server.Services.Files;

/// <summary>The blob operations the file store needs. A missing container reads as empty.</summary>
public interface IBlobStorage
{
    Task EnsureContainerAsync(string container, CancellationToken cancellationToken);

    /// <summary>Creates an empty blob. False when the name is taken.</summary>
    Task<bool> TryCreateEmptyAsync(string container, string name, CancellationToken cancellationToken);

    Task<bool> ExistsAsync(string container, string name, CancellationToken cancellationToken);

    /// <summary>A stream that replaces the blob when it is disposed.</summary>
    Task<Stream> OpenWriteAsync(string container, string name, CancellationToken cancellationToken);

    /// <summary>Null when the blob does not exist.</summary>
    Task<Stream?> OpenReadAsync(string container, string name, CancellationToken cancellationToken);

    /// <summary>The names of the blobs that start with <paramref name="prefix"/>.</summary>
    IAsyncEnumerable<string> ListAsync(string container, string prefix, CancellationToken cancellationToken);

    Task DeleteAsync(string container, string name, CancellationToken cancellationToken);

    Task DeleteContainerAsync(string container, CancellationToken cancellationToken);
}
