using System;

namespace ChatUitReact.Server.Models;

/// <summary>
/// Where an endpoint row points. The type picks the host provider, which composes the URL
/// for the model's <see cref="ApiProtocol"/>; it says nothing about the protocol itself.
/// </summary>
public enum EndpointType
{
    /// <summary>An Azure OpenAI resource: OpenAI protocols under /openai/v1, no Anthropic surface.</summary>
    AzureOpenAI,
    OpenAI,
    /// <summary>Anthropic's own API, or any host that serves only Anthropic Messages at the URL as typed.</summary>
    Anthropic,
    LlamaCpp,
    Other,
    /// <summary>
    /// A Microsoft Foundry (Azure AI Services) resource. The URL is the resource base, e.g.
    /// https://&lt;resource&gt;.services.ai.azure.com; the provider appends /openai/v1 or /anthropic.
    /// </summary>
    MicrosoftFoundry
}

public class ModelEndpoint
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Url { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public EndpointType EndpointType { get; set; } = EndpointType.AzureOpenAI;
}
