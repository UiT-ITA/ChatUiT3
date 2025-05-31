using System;

namespace ChatUitReact.Server.Models;

public enum EndpointType
{
    AzureOpenAI,
    OpenAI,
    Anthropic,
    LlamaCpp,
    Other
}

public class ModelEndpoint
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Url { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public EndpointType EndpointType { get; set; } = EndpointType.AzureOpenAI;
}
