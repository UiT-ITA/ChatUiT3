using Azure.Core;

namespace ChatUiT.Server.Services.AiProviders;

using ChatUiT.Server.Models;
using ChatUiT.Server.Services.AiProviders.Images;
using ChatUiT.Server.Services.AiProviders.Protocols;

/// <summary>
/// An Azure OpenAI resource (<c>https://&lt;resource&gt;.openai.azure.com</c>). Serves the
/// OpenAI protocols and OpenAI Images under <c>/openai/v1</c>; it has no Anthropic or MAI surface, which is what
/// separates it from <see cref="MicrosoftFoundryProvider"/>.
/// </summary>
public sealed class AzureOpenAiProvider : OpenAiV1HostProvider
{
    public AzureOpenAiProvider(IApiProtocolRegistry protocols, IImageApiRegistry imageApis, TokenCredential credential) : base(protocols, imageApis, credential)
    {
    }

    public override EndpointType EndpointType => EndpointType.AzureOpenAI;

    protected override string? PathFor(ApiProtocol protocol) => protocol switch
    {
        ApiProtocol.OpenAiChatCompletions or ApiProtocol.OpenAiResponses => "/openai/v1",
        _ => null
    };

    protected override string? PathFor(ImageApi api) => api switch
    {
        ImageApi.OpenAiImages => "/openai/v1",
        _ => null
    };
}
