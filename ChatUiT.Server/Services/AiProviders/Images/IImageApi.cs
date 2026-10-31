using System.Collections.Generic;
using System.Linq;
using System.Threading;

namespace ChatUiT.Server.Services.AiProviders.Images;

using ChatUiT.Server.Models;
using ChatUiT.Server.Services.AiProviders.Protocols;

/// <summary>
/// One image API. Adapters translate an <see cref="ImageRequest"/> into the API's wire format
/// and back. They do not know which host they talk to (the <see cref="IAiProvider"/> does, and
/// hands them a <see cref="ProtocolTarget"/>) and do not check the request against the
/// model (<see cref="ImageParameterValidator"/> does).
/// </summary>
public interface IImageApi
{
    ImageApi Api { get; }

    /// <summary>Throws <see cref="ImageGenerationFailedException"/> when the API refuses or fails the request.</summary>
    IAsyncEnumerable<ImageStreamEvent> GenerateAsync(ImageRequest request, ProtocolTarget target, CancellationToken cancellationToken);
}

/// <summary>Resolves the adapter registered for an image API.</summary>
public interface IImageApiRegistry
{
    /// <summary>Throws <see cref="NotSupportedException"/> when no adapter handles the API.</summary>
    IImageApi For(ImageApi api);
}

/// <summary>
/// Maps image APIs to the registered adapter. Built from whatever <see cref="IImageApi"/>
/// implementations DI supplies, so registering an adapter is the only step needed.
/// </summary>
public sealed class ImageApiRegistry : IImageApiRegistry
{
    private readonly Dictionary<ImageApi, IImageApi> _apis;

    public ImageApiRegistry(IEnumerable<IImageApi> apis)
    {
        _apis = apis.ToDictionary(a => a.Api);
    }

    public IImageApi For(ImageApi api)
    {
        if (_apis.TryGetValue(api, out var adapter))
        {
            return adapter;
        }

        throw new NotSupportedException(
            $"No adapter is registered for image API {api}. " +
            $"Registered APIs: {string.Join(", ", _apis.Keys)}.");
    }
}
