namespace ChatUitReact.Server.Models.DTOs;

public class AiChatSummaryDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string AssistantName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string LastMessagePreview { get; set; } = string.Empty;
}


public class AiChatDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string UserId { get; set; } = string.Empty;
    public AiAssistantDto Assistant { get; set; } = new();
    public List<AiChatMessageDto> Messages { get; set; } = new();
}

public class AiChatMessageDto
{
    public string Id { get; set; } = string.Empty;
    public string ChatId { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty; // "user", "assistant", "system"
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class AiChatCreateDto
{
    public string Name { get; set; } = string.Empty;
    public string AssistantId { get; set; } = string.Empty;
}