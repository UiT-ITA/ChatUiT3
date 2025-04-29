namespace ChatUitReact.Server.Models.DTOs;

public class AiChatSummaryDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string AssistantName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string LastMessagePreview { get; set; } = string.Empty;
    public int MessageCount { get; set; } = 0;
}

public class AiChatDto
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public AiAssistantDto Assistant { get; set; } = new AiAssistantDto();
    public AiModelSettingsDto CurrentSettings { get; set; } = new AiModelSettingsDto();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<AiChatMessageDto> Messages { get; set; } = new List<AiChatMessageDto>();
    public List<AiChatFileDto> Files { get; set; } = new List<AiChatFileDto>();
}

public class AiChatMessageDto
{
    public string Id { get; set; } = string.Empty;
    public string Role { get; set; } = "user";
    public DateTime Timestamp { get; set; }
    public string Content { get; set; } = string.Empty;
    public List<AiChatFileDto> Files { get; set; } = new List<AiChatFileDto>();
}

public class AiChatFileDto
{
    public string Id { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; } = 0;
    public DateTime UploadedAt { get; set; }
    public bool IsProcessed { get; set; } = false;
}

public class AiChatCreateDto
{
    public string Name { get; set; } = string.Empty;
    public string AssistantId { get; set; } = string.Empty;
    public string InitialMessage { get; set; } = string.Empty;
}

public class AiChatMessageCreateDto
{
    public string ChatId { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public List<string> FileIds { get; set; } = new List<string>();
}
