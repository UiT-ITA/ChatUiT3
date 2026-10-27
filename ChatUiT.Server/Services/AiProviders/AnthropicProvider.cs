using System;
using System.Threading;
using System.Threading.Tasks;

namespace ChatUiT.Server.Services.AiProviders;

using ChatUiT.Server.Models;
using ChatUiT.Server.Services.AiProviders.Protocols;

/// <summary>
/// A host that speaks Anthropic Messages at the URL exactly as typed — Anthropic's own API
/// when the URL is blank, or any gateway that serves only that protocol. The endpoint row
/// holds the base the SDK appends <c>/v1/messages</c> to.
/// </summary>
public sealed class AnthropicProvider : IAiProvider
{
    private readonly IApiProtocolRegistry _protocols;

    public AnthropicProvider(IApiProtocolRegistry protocols)
    {
        _protocols = protocols;
    }

    public EndpointType EndpointType => EndpointType.Anthropic;

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

    private (IApiProtocol Protocol, ProtocolTarget Target) Resolve(AiRequest request)
    {
        var protocol = ApiProtocols.Require(request.Model);
        if (protocol != ApiProtocol.AnthropicMessages)
        {
            throw new NotSupportedException(
                $"An Anthropic endpoint serves only Anthropic Messages, but model '{request.Model.ModelId}' is set to {protocol}. " +
                "Put the model on a Microsoft Foundry endpoint, or change its API protocol.");
        }

        var url = request.Endpoint.Url.Trim();
        var target = new ProtocolTarget(url.Length == 0 ? null : url, request.Endpoint.ApiKey);
        return (_protocols.For(protocol), target);
    }
}
