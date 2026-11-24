using System.Runtime.CompilerServices;
using ChatUiT.Server.Services.Files;

namespace ChatUiT.Server.Tests;

/// <summary>Blob storage held in memory.</summary>
public sealed class InMemoryBlobStorage : IBlobStorage
{
    public Dictionary<string, Dictionary<string, (byte[] Data, Dictionary<string, string> Metadata)>> Containers { get; } = new();

    public byte[] Data(string container, string name) => Containers[container][name].Data;

    public IEnumerable<string> Names(string container)
        => Containers.TryGetValue(container, out var blobs) ? blobs.Keys.Order(StringComparer.Ordinal) : [];

    public Task EnsureContainerAsync(string container, CancellationToken cancellationToken)
    {
        Containers.TryAdd(container, new());
        return Task.CompletedTask;
    }

    public Task<bool> TryCreateEmptyAsync(string container, string name, CancellationToken cancellationToken)
        => Task.FromResult(Containers[container].TryAdd(name, ([], new())));

    public Task<Stream> OpenWriteAsync(string container, string name, IDictionary<string, string> metadata, CancellationToken cancellationToken)
        => Task.FromResult<Stream>(new CommitStream(data => Containers[container][name] = (data, new(metadata))));

    public Task<BlobContent?> OpenReadAsync(string container, string name, CancellationToken cancellationToken)
        => Task.FromResult(Containers.TryGetValue(container, out var blobs) && blobs.TryGetValue(name, out var blob)
            ? new BlobContent(new MemoryStream(blob.Data), blob.Metadata, blob.Data.Length)
            : null);

    public async IAsyncEnumerable<BlobEntry> ListAsync(string container, string prefix, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        await Task.CompletedTask;
        if (!Containers.TryGetValue(container, out var blobs))
        {
            yield break;
        }

        foreach (var (name, blob) in blobs.Where(pair => pair.Key.StartsWith(prefix, StringComparison.Ordinal)).ToList())
        {
            yield return new BlobEntry(name, blob.Metadata);
        }
    }

    public Task DeleteAsync(string container, string name, CancellationToken cancellationToken)
    {
        if (Containers.TryGetValue(container, out var blobs))
        {
            blobs.Remove(name);
        }

        return Task.CompletedTask;
    }

    public Task DeleteContainerAsync(string container, CancellationToken cancellationToken)
    {
        Containers.Remove(container);
        return Task.CompletedTask;
    }

    private sealed class CommitStream(Action<byte[]> commit) : MemoryStream
    {
        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                commit(ToArray());
            }

            base.Dispose(disposing);
        }
    }
}
