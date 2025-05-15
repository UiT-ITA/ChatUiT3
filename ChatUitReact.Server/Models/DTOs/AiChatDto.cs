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
    public string Sender { get; set; } = "user"; // "user", "assistant", "system", "tool", "file"
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public List<MessageChunkDto> Chunks { get; set; } = new List<MessageChunkDto>();
    public string ContentType { get; set; } = "text"; // "text", "image", "mixed"
    public string? Filename { get; set; }  // Only for file messages
    
    // For backward compatibility
    public string Text 
    { 
        get
        {
            return string.Join("\n", Chunks
                .Where(c => c.Type == "text")
                .Select(c => c.Content));
        }
    }
}

/// <summary>
/// DTO for message content chunk
/// </summary>
public class MessageChunkDto
{
    public string Type { get; set; } = "text"; // "text" or "image"
    public string Content { get; set; } = string.Empty;
}

/// <summary>
/// DTO for creating a new message
/// </summary>
public class CreateMessageDto
{
    public string ChatId { get; set; } = string.Empty;
    public List<MessageChunkDto> Chunks { get; set; } = new List<MessageChunkDto>();
    public string? Filename { get; set; }
    
    // For backward compatibility
    public string Text
    {
        get
        {
            return Chunks.FirstOrDefault()?.Content ?? string.Empty;
        }
    }
}

/// <summary>
/// DTO for creating a new chat
/// </summary>
public class CreateChatDto
{
    public string Title { get; set; } = string.Empty;
    public string? AssistantId { get; set; }
    public List<CreateMessageDto> Messages { get; set; } = new List<CreateMessageDto>();
    
    /// <summary>
    /// Shorthand method to add a single text message
    /// </summary>
    public void AddTextMessage(string content, string sender = "user")
    {
        Messages.Add(new CreateMessageDto
        {
            Chunks = new List<MessageChunkDto>
            {
                new MessageChunkDto
                {
                    Type = "text",
                    Content = content
                }
            }
        });
    }
}
