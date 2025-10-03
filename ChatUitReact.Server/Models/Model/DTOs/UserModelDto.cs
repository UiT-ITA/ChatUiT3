using System;

namespace ChatUitReact.Server.Models;

public class UserModelCapabilitiesDto
{
    public bool Vision { get; set; }
    public bool Reasoning { get; set; }
    public bool Tools { get; set; }
    public bool SupportsTemperature { get; set; }
    public int ContextSize { get; set; }
    public int MaxOutputTokens { get; set; }
    // Month-year string (e.g., "2024-06")
    public string KnowledgeCutoff { get; set; } = string.Empty;
}

public class UserModelDto
{
    public string Id { get; set; } = string.Empty;
    public string ModelName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public UserModelCapabilitiesDto Capabilities { get; set; } = new UserModelCapabilitiesDto();
}
