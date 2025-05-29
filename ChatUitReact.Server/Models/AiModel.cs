namespace ChatUitReact.Server.Models;

public class AiModel
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string ModelName { get; set; } = string.Empty;
    public string EndpointId { get; set; } = string.Empty;
    public List<UserRole> AllowedRoles { get; set; } = new List<UserRole>();
}

public enum AiEndpointType
{
    AzureOpenAI,
    OpenAI,
    Anthropic,
    LlamaCpp,
    Other
}

public class AiModelEndpoint
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Url { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public AiEndpointType EndpointType { get; set; } = AiEndpointType.AzureOpenAI;
}

public class AiModelSettings
{
    public float Temperature { get; set; } = 0.5f;
    public ReasoningEffort ReasoningEffort { get; set; } = ReasoningEffort.None;
}

public class AiModelCapabilities
{
    public bool SupportsVision { get; set; } = false;
    public bool SupportsReasoning { get; set; } = false;
    public bool SupportsFunctionCalling { get; set; } = false;
    public bool SupportsCodeInterpreter { get; set; } = false;
    public int MaxContextLength { get; set; } = 16_000;
    public int MaxOutputLength { get; set; } = 16_000;
}

public enum ReasoningEffort
{
    None,
    Low,
    Medium,
    High
}
