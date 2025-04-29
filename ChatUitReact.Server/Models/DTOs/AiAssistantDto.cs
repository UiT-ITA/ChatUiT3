namespace ChatUitReact.Server.Models.DTOs;

public class AiAssistantDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public AiModelDto Model { get; set; } = new AiModelDto();
    public AiModelSettingsDto ModelSettings { get; set; } = new AiModelSettingsDto();
    public List<AiChatToolDto> Tools { get; set; } = new List<AiChatToolDto>();
    public bool IsSystemCreated { get; set; } = false;
}

public class AiModelDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ModelType { get; set; } = string.Empty;
    public AiModelCapabilitiesDto Capabilities { get; set; } = new AiModelCapabilitiesDto();
}

public class AiModelSettingsDto
{
    public float Temperature { get; set; } = 0.5f;
    public int MaxTokens { get; set; } = 4000;
    public float TopP { get; set; } = 1.0f;
    public string ReasoningEffort { get; set; } = "none";
}

public class AiModelCapabilitiesDto
{
    public bool SupportsVision { get; set; } = false;
    public bool SupportsReasoning { get; set; } = false;
    public bool SupportsFunctionCalling { get; set; } = false;
    public int MaxContextLength { get; set; } = 16000;
}

public class AiChatToolDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Type { get; set; } = "function";
}

public class AiAssistantCreateDto
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ModelId { get; set; } = string.Empty;
    public string SystemPrompt { get; set; } = string.Empty;
    public AiModelSettingsDto ModelSettings { get; set; } = new AiModelSettingsDto();
    public List<string> ToolIds { get; set; } = new List<string>();
}
