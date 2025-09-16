using System;

namespace ChatUitReact.Server.Models;

public class ChatHeader
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string AssistantId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public AiChatStatus Status { get; set; } = AiChatStatus.Success;
}
