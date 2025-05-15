namespace ChatUitReact.Server.Models.DTOs;

/// <summary>
/// DTO for sending chat list items (used for sidebar)
/// </summary>
public class ChatListItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
    public string? AssistantId { get; set; }
}

/// <summary>
/// DTO for complete chat details including messages
/// </summary>
public class ChatDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
    public List<MessageDto> Messages { get; set; } = new List<MessageDto>();
    public string? AssistantId { get; set; }
}

/// <summary>
/// DTO for individual message
/// </summary>
public class MessageDto
{
    public string Id { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string Sender { get; set; } = "user"; // "user", "assistant", or "system"
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// DTO for creating a new message
/// </summary>
public class CreateMessageDto
{
    public string ChatId { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
}

/// <summary>
/// DTO for creating a new chat
/// </summary>
public class CreateChatDto
{
    public string Title { get; set; } = string.Empty;
    public string? AssistantId { get; set; }
}

