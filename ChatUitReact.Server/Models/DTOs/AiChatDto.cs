using System.Text.Json.Serialization;

namespace ChatUitReact.Server.Models.DTOs;

public class ChatListItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
}

public class ChatDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
    public List<MessageDto> Messages { get; set; } = new List<MessageDto>();
}

public class MessageDto
{
    public string Id { get; set; } = string.Empty;
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public AiChatRole Role { get; set; } = AiChatRole.User;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public List<MessageChunkDto> Chunks { get; set; } = new List<MessageChunkDto>();
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public AiMessageStatus Status { get; set; } = AiMessageStatus.Sent;
    public string? Filename { get; set; }
    
}

public class MessageChunkDto
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public AiMessageChunkType Type { get; set; } = AiMessageChunkType.Text;
    public string Content { get; set; } = string.Empty;
    }


