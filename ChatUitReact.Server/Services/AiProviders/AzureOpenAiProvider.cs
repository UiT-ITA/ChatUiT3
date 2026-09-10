namespace ChatUitReact.Server.Services.AiProviders;

using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.AiProviders.Protocols;

/// <summary>
/// An Azure OpenAI resource (<c>https://&lt;resource&gt;.openai.azure.com</c>). Serves the
/// OpenAI protocols under <c>/openai/v1</c>; it has no Anthropic surface, which is what
/// separates it from <see cref="MicrosoftFoundryProvider"/>.
/// </summary>
public sealed class AzureOpenAiProvider : OpenAiV1HostProvider
{
    public AzureOpenAiProvider(IApiProtocolRegistry protocols) : base(protocols)
    {
    }

    public override EndpointType EndpointType => EndpointType.AzureOpenAI;

    protected override string? PathFor(ApiProtocol protocol) => protocol switch
    {
        ApiProtocol.OpenAiChatCompletions or ApiProtocol.OpenAiResponses => "/openai/v1",
        _ => null
    };
}
