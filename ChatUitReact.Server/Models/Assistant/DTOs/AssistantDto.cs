using System.ComponentModel.DataAnnotations;

namespace ChatUitReact.Server.Models;

public class AssistantListDto
{
    public List<FullAssistantDto> Owned { get; set; } = new List<FullAssistantDto>();
    public List<AssistantSummaryDto> System { get; set; } = new List<AssistantSummaryDto>();
    public List<AssistantSummaryDto> Shared { get; set; } = new List<AssistantSummaryDto>();
}

public class FullAssistantDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new List<string>();
    public string ModelId { get; set; } = string.Empty;
    public string SystemPrompt { get; set; } = string.Empty;
    public float Temperature { get; set; } = 0.7f;
    public ReasoningEffort ReasoningEffort { get; set; } = ReasoningEffort.None;
    public List<string> AvailableToolIds { get; set; } = new List<string>();
    public bool IsVisible { get; set; }
}

public class AssistantSummaryDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new List<string>();
    public string ModelId { get; set; } = string.Empty;
    public bool IsVisible { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
}

public class CreateAssistantDto
{
    [Required]
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new List<string>();
    [Required]
    public string ModelId { get; set; } = string.Empty;
    public string SystemPrompt { get; set; } = string.Empty;
    public float Temperature { get; set; } = 0.7f;
    public ReasoningEffort ReasoningEffort { get; set; } = ReasoningEffort.None;
    public List<string> AvailableToolIds { get; set; } = new List<string>();
}

public class UpdateAssistantDto
{
    [Required]
    public string Id { get; set; } = string.Empty;
    [Required]
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new List<string>();
    [Required]
    public string ModelId { get; set; } = string.Empty;
    public string SystemPrompt { get; set; } = string.Empty;
    public float Temperature { get; set; } = 0.7f;
    public ReasoningEffort ReasoningEffort { get; set; } = ReasoningEffort.None;
    public List<string> AvailableToolIds { get; set; } = new List<string>();
}
