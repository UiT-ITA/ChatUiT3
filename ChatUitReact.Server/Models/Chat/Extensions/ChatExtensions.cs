using System.Linq;

namespace ChatUitReact.Server.Models;

public static class ChatExtensions
{
    // Chat to DTO conversions
    public static ChatHeaderDto ToHeaderDto(this ChatHeader chat)
    {
        return new ChatHeaderDto
        {
            Id = chat.Id,
            Name = chat.Name,
            CreatedAt = chat.CreatedAt,
            UpdatedAt = chat.UpdatedAt,
            Status = chat.Status
        };
    }

    public static ChatHeaderDto ToHeaderDto(this Chat chat)
    {
        return new ChatHeaderDto
        {
            Id = chat.Id,
            Name = chat.Name,
            CreatedAt = chat.CreatedAt,
            UpdatedAt = chat.UpdatedAt,
            Status = chat.Status
        };
    }

    public static ChatDto ToDto(this Chat chat)
    {
        return new ChatDto
        {
            Id = chat.Id,
            Name = chat.Name,
            CreatedAt = chat.CreatedAt,
            UpdatedAt = chat.UpdatedAt,
            Status = chat.Status,
            AssistantId = chat.AssistantId,
            Messages = chat.Messages.Select(m => m.ToDto()).ToList()
        };
    }

    public static ChatMessageDto ToDto(this ChatMessage message)
    {
        return new ChatMessageDto
        {
            Id = message.Id,
            Role = message.Role,
            Timestamp = message.Timestamp,
            Content = message.Content,
            Status = message.Status
        };
    }

    // DTO to Model conversions
    public static Chat ToModel(this ChatDto dto)
    {
        return new Chat
        {
            Id = dto.Id,
            Name = dto.Name,
            CreatedAt = dto.CreatedAt,
            UpdatedAt = dto.UpdatedAt,
            Status = dto.Status,
            AssistantId = dto.AssistantId,
            Messages = dto.Messages.Select(m => m.ToModel()).ToList()
        };
    }

    public static ChatMessage ToModel(this ChatMessageDto dto)
    {
        return new ChatMessage
        {
            Id = dto.Id,
            Role = dto.Role,
            Timestamp = dto.Timestamp,
            Content = dto.Content,
            Status = dto.Status
        };
    }

    public static ChatMessage ToModel(this SendMessageDto dto)
    {
        return new ChatMessage
        {
            Role = AiChatRole.User,
            Content = dto.Content,
            Status = AiChatStatus.Success
        };
    }
}
