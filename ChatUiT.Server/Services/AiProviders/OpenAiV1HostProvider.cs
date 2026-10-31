using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Azure.Core;

namespace ChatUiT.Server.Services.AiProviders;

using ChatUiT.Server.Models;
using ChatUiT.Server.Services.AiProviders.Images;
using ChatUiT.Server.Services.AiProviders.Protocols;

/// <summary>
/// Shared shape of the Azure-hosted endpoint types: the endpoint row holds a resource base
/// URL, and the host appends the path the model's protocol or image API is served on before
/// handing off to its adapter. Subclasses differ only in which of those the resource serves.
/// </summary>
public abstract class OpenAiV1HostProvider : IAiProvider
{
    private readonly IApiProtocolRegistry _protocols;
    private readonly IImageApiRegistry _imageApis;
    private readonly TokenCredential _credential;

    protected OpenAiV1HostProvider(IApiProtocolRegistry protocols, IImageApiRegistry imageApis, TokenCredential credential)
    {
        _protocols = protocols;
        _imageApis = imageApis;
        _credential = credential;
    }

    public abstract EndpointType EndpointType { get; }

    public IAiConversation StartConversation(AiRequest request)
    {
        var (protocol, target) = Resolve(request);
        return protocol.StartConversation(request, target);
    }

    public Task<string> GenerateChatNameAsync(AiRequest request, CancellationToken cancellationToken = default)
    {
        var (protocol, target) = Resolve(request);
        return protocol.GenerateChatNameAsync(request, target, cancellationToken);
    }

    public IAsyncEnumerable<ImageStreamEvent> GenerateImagesAsync(ImageRequest request, CancellationToken cancellationToken = default)
    {
        var api = request.Model.ImageApi;
        var path = PathFor(api) ?? throw new NotSupportedException(
            $"A {EndpointType} endpoint does not serve {api}, but image model '{request.Model.ModelId}' is set to it. " +
            "Move the model to an endpoint that serves that API, or change its image API.");

        var target = Target(request.Endpoint, path);
        return _imageApis.For(api).GenerateAsync(request, target, cancellationToken);
    }

    /// <summary>The path under the resource base for a protocol, or null when this host does not serve it.</summary>
    protected abstract string? PathFor(ApiProtocol protocol);

    /// <summary>The path under the resource base for an image API, or null when this host does not serve it.</summary>
    protected abstract string? PathFor(ImageApi api);

    private (IApiProtocol Protocol, ProtocolTarget Target) Resolve(AiRequest request)
    {
        var protocol = request.Model.ApiProtocol;

        var path = PathFor(protocol) ?? throw new NotSupportedException(
            $"A {EndpointType} endpoint does not serve {protocol}, but model '{request.Model.ModelId}' is set to it. " +
            "Move the model to an endpoint that serves that protocol, or change its API protocol.");

        return (_protocols.For(protocol), Target(request.Endpoint, path));
    }

    private ProtocolTarget Target(ModelEndpoint endpoint, string path)
    {
        var baseUrl = endpoint.Url.Trim().TrimEnd('/');
        if (baseUrl.Length == 0)
        {
            throw new InvalidOperationException($"The {EndpointType} endpoint has no URL. Set the resource base URL in the admin panel.");
        }

        var credential = endpoint.AuthMethod == EndpointAuthMethod.ManagedIdentity ? _credential : null;
        return new ProtocolTarget(baseUrl + path, endpoint.ApiKey, credential);
    }
}
