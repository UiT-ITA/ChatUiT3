namespace ChatUitReact.Server.Models;

public class AiModel
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ModelId { get; set; } = string.Empty;
    public AiModelType ModelType { get; set; } = AiModelType.AzureOpenAI;
    public AiModelEndpoint Endpoint { get; set; } = new AiModelEndpoint();
    public AiModelCapabilities Capabilities { get; set; } = new AiModelCapabilities();
}

public enum AiModelType
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
    // Additional endpoint-specific properties could be added here
}

public class AiModelSettings
{
    public float Temperature { get; set; } = 0.5f;
    public int MaxTokens { get; set; } = 4000;
    public float TopP { get; set; } = 1.0f;
    public float FrequencyPenalty { get; set; } = 0.0f;
    public float PresencePenalty { get; set; } = 0.0f;
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
