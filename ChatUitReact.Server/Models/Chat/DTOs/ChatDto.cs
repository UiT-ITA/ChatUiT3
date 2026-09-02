using System;
using System.Collections.Generic;

namespace ChatUitReact.Server.Models;

public class ChatHeaderDto
{
    public string Id { get; set; } = string.Empty;
    public string AssistantId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public AiChatStatus Status { get; set; }
    public bool IsFavorite { get; set; }
}

public class ChatDto : ChatHeaderDto
{
    public List<ChatMessageDto> Messages { get; set; } = new List<ChatMessageDto>();
}

public class ChatMessageDto
{
    public string Id { get; set; } = string.Empty;
    public AiChatRole Role { get; set; }
    public DateTime Timestamp { get; set; }
    public string Content { get; set; } = string.Empty;
    public AiChatStatus Status { get; set; }
    public List<ChatFileDto> Files { get; set; } = new List<ChatFileDto>();
    public string AssistantId { get; set; } = string.Empty;
    public string AssistantName { get; set; } = string.Empty;
    public MessageActivity? Activity { get; set; }
}

public class ChatFileChunkDto
{
    public string Type { get; set; } = string.Empty;
    public string? Text { get; set; }
    public string? Format { get; set; }
    public string? Base64 { get; set; }
}

public class ChatFileDto
{
    public string Id { get; set; } = string.Empty;
    public string SourceFilename { get; set; } = string.Empty;
    public List<ChatFileChunkDto> Chunks { get; set; } = new List<ChatFileChunkDto>();
}

public class CreateChatFileDto
{
    public string SourceFilename { get; set; } = string.Empty;
    public List<ChatFileChunkDto> Chunks { get; set; } = new List<ChatFileChunkDto>();
}

public class CreateChatDto
{
    public string AssistantId { get; set; } = string.Empty;
    public List<SendMessageDto> Messages { get; set; } = new List<SendMessageDto>();
}

public class UpdateChatDto
{
    public string? Name { get; set; }
    public bool? IsFavorite { get; set; }
}

public class SendMessageDto
{
    public string Content { get; set; } = string.Empty;
    public List<CreateChatFileDto>? Files { get; set; }
    public string AssistantId { get; set; } = string.Empty;
}

public class ChatToolDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}
