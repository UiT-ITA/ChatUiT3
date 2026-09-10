using System;
using System.Threading;
using System.Threading.Tasks;

namespace ChatUitReact.Server.Services.AiProviders;

using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.AiProviders.Protocols;

/// <summary>
/// Shared shape of the Azure-hosted endpoint types: the endpoint row holds a resource base
/// URL, and the host appends the path the model's protocol is served on before handing off
/// to that protocol's adapter. Subclasses differ only in which protocols the resource serves.
/// </summary>
public abstract class OpenAiV1HostProvider : IAiProvider
{
    private readonly IApiProtocolRegistry _protocols;

    protected OpenAiV1HostProvider(IApiProtocolRegistry protocols)
    {
        _protocols = protocols;
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

    /// <summary>The path under the resource base for a protocol, or null when this host does not serve it.</summary>
    protected abstract string? PathFor(ApiProtocol protocol);

    private (IApiProtocol Protocol, ProtocolTarget Target) Resolve(AiRequest request)
    {
        var protocol = ApiProtocols.Require(request.Model);

        var baseUrl = request.Endpoint.Url.Trim().TrimEnd('/');
        if (baseUrl.Length == 0)
        {
            throw new InvalidOperationException($"The {EndpointType} endpoint has no URL. Set the resource base URL in the admin panel.");
        }

        var path = PathFor(protocol) ?? throw new NotSupportedException(
            $"A {EndpointType} endpoint does not serve {protocol}, but model '{request.Model.ModelId}' is set to it. " +
            "Move the model to an endpoint that serves that protocol, or change its API protocol.");

        return (_protocols.For(protocol), new ProtocolTarget(baseUrl + path, request.Endpoint.ApiKey));
    }
}
