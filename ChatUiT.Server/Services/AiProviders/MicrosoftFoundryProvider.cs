using Azure.Core;

namespace ChatUiT.Server.Services.AiProviders;

using ChatUiT.Server.Models;
using ChatUiT.Server.Services.AiProviders.Images;
using ChatUiT.Server.Services.AiProviders.Protocols;

/// <summary>
/// A Microsoft Foundry (Azure AI Services) resource. One resource serves every protocol
/// from one base URL: OpenAI Responses and Chat Completions under <c>/openai/v1</c>,
/// Anthropic Messages under <c>/anthropic</c>, OpenAI Images under <c>/openai/v1</c> and MAI
/// Images under <c>/mai/v1</c>. The endpoint row holds the resource base,
/// e.g. <c>https://&lt;resource&gt;.services.ai.azure.com</c>. The model id sent on the
/// wire is the Foundry deployment name.
/// </summary>
public sealed class MicrosoftFoundryProvider : OpenAiV1HostProvider
{
    public MicrosoftFoundryProvider(IApiProtocolRegistry protocols, IImageApiRegistry imageApis, TokenCredential credential) : base(protocols, imageApis, credential)
    {
    }

    public override EndpointType EndpointType => EndpointType.MicrosoftFoundry;

    protected override string? PathFor(ApiProtocol protocol) => protocol switch
    {
        ApiProtocol.OpenAiChatCompletions or ApiProtocol.OpenAiResponses => "/openai/v1",
        ApiProtocol.AnthropicMessages => "/anthropic",
        _ => null
    };

    protected override string? PathFor(ImageApi api) => api switch
    {
        ImageApi.OpenAiImages => "/openai/v1",
        ImageApi.MaiImages => "/mai/v1",
        _ => null
    };
}
