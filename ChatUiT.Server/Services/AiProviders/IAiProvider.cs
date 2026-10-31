using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace ChatUiT.Server.Services.AiProviders;

using ChatUiT.Server.Models;
using ChatUiT.Server.Services.AiProviders.Images;

/// <summary>
/// One host: where an endpoint row points. A host knows how to compose the base URL for
/// each <see cref="ApiProtocol"/> and <see cref="ImageApi"/> it serves and which those are; it
/// hands the request to the adapter (<c>Protocols.IApiProtocol</c>, <c>Images.IImageApi</c>),
/// which owns the wire format. Neither decides what a model supports (<see cref="ChatParameterResolver"/> has)
/// or runs the tool-call loop (<see cref="AiConversationRunner"/> does).
///
/// Adding a host means adding one class and registering it; nothing dispatches on
/// <see cref="EndpointType"/> outside the registry. Adding a protocol means adding one
/// adapter and registering it; hosts route to it by the model's declared protocol.
/// </summary>
public interface IAiProvider
{
    EndpointType EndpointType { get; }

    IAiConversation StartConversation(AiRequest request);

    /// <summary>Generates a chat name with a single non-streamed, length-bounded completion.</summary>
    Task<string> GenerateChatNameAsync(AiRequest request, CancellationToken cancellationToken = default);

    /// <summary>Runs one image generation or edit on the model's image API.</summary>
    IAsyncEnumerable<ImageStreamEvent> GenerateImagesAsync(ImageRequest request, CancellationToken cancellationToken = default);
}

/// <summary>Resolves the provider registered for an endpoint's type.</summary>
public interface IAiProviderRegistry
{
    /// <summary>Throws <see cref="NotSupportedException"/> when no provider handles the type.</summary>
    IAiProvider For(EndpointType endpointType);

    bool Supports(EndpointType endpointType);
}
