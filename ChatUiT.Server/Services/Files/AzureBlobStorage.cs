using System.Runtime.CompilerServices;
using Azure;
using Azure.Core;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Blobs.Specialized;

namespace ChatUiT.Server.Services.Files;

/// <summary>Azure Blob Storage at BlobStorage:AccountEndpoint, reached with the app's Entra identity.</summary>
public sealed class AzureBlobStorage : IBlobStorage
{
    private readonly BlobServiceClient? _client;

    public AzureBlobStorage(IConfiguration configuration, TokenCredential credential)
    {
        var endpoint = configuration["BlobStorage:AccountEndpoint"];
        if (!string.IsNullOrWhiteSpace(endpoint))
        {
            _client = new BlobServiceClient(new Uri(endpoint), credential);
        }
    }

    private BlobContainerClient Container(string container)
        => (_client ?? throw new InvalidOperationException("File storage is not configured. Set BlobStorage:AccountEndpoint."))
            .GetBlobContainerClient(container);

    public async Task EnsureContainerAsync(string container, CancellationToken cancellationToken)
        => await Container(container).CreateIfNotExistsAsync(cancellationToken: cancellationToken);

    public async Task<bool> TryCreateEmptyAsync(string container, string name, CancellationToken cancellationToken)
    {
        try
        {
            await Container(container).GetBlobClient(name).UploadAsync(
                BinaryData.FromBytes(Array.Empty<byte>()),
                new BlobUploadOptions { Conditions = new BlobRequestConditions { IfNoneMatch = ETag.All } },
                cancellationToken);
            return true;
        }
        catch (RequestFailedException ex) when (ex.ErrorCode == BlobErrorCode.BlobAlreadyExists || ex.ErrorCode == BlobErrorCode.ConditionNotMet)
        {
            return false;
        }
    }

    public async Task<Stream> OpenWriteAsync(string container, string name, IDictionary<string, string> metadata, CancellationToken cancellationToken)
        => await Container(container).GetBlockBlobClient(name).OpenWriteAsync(
            overwrite: true,
            new BlockBlobOpenWriteOptions { Metadata = metadata },
            cancellationToken);

    public async Task<BlobContent?> OpenReadAsync(string container, string name, CancellationToken cancellationToken)
    {
        try
        {
            var response = await Container(container).GetBlobClient(name).DownloadStreamingAsync(cancellationToken: cancellationToken);
            var details = response.Value.Details;
            return new BlobContent(response.Value.Content, new Dictionary<string, string>(details.Metadata), details.ContentLength);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }

    public async IAsyncEnumerable<BlobEntry> ListAsync(string container, string prefix, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var blobs = Container(container).GetBlobsAsync(new GetBlobsOptions { Traits = BlobTraits.Metadata, Prefix = prefix }, cancellationToken);
        await using var enumerator = blobs.GetAsyncEnumerator(cancellationToken);
        while (true)
        {
            try
            {
                if (!await enumerator.MoveNextAsync())
                {
                    yield break;
                }
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                yield break;
            }

            yield return new BlobEntry(enumerator.Current.Name, new Dictionary<string, string>(enumerator.Current.Metadata ?? new Dictionary<string, string>()));
        }
    }

    public async Task DeleteAsync(string container, string name, CancellationToken cancellationToken)
        => await Container(container).GetBlobClient(name).DeleteIfExistsAsync(cancellationToken: cancellationToken);

    public async Task DeleteContainerAsync(string container, CancellationToken cancellationToken)
        => await Container(container).DeleteIfExistsAsync(cancellationToken: cancellationToken);
}
