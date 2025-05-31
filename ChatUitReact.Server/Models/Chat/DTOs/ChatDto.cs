using System;
using System.Collections.Generic;

namespace ChatUitReact.Server.Models;

public class ChatHeaderDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public AiChatStatus Status { get; set; }
}

public class ChatDto : ChatHeaderDto
{
    public string? AssistantId { get; set; }
    public List<ChatMessageDto> Messages { get; set; } = new List<ChatMessageDto>();
}

public class ChatMessageDto
{
    public string Id { get; set; } = string.Empty;
    public AiChatRole Role { get; set; }
    public DateTime Timestamp { get; set; }
    public string Content { get; set; } = string.Empty;
    public AiChatStatus Status { get; set; }
}

public class CreateChatDto
{
    public string? AssistantId { get; set; }
    public List<ChatMessageDto> Messages { get; set; } = new List<ChatMessageDto>();
}

public class SendMessageDto
{
    public string Content { get; set; } = string.Empty;
    public string? AssistantId { get; set; }
}
