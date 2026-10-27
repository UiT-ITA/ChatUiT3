namespace ChatUiT.Server.Models;

/// <summary>A knowledge source as the assistant editor sees it: only sources the caller may use are listed.</summary>
public class KnowledgeSourceDto
{
    public string Id { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
}
