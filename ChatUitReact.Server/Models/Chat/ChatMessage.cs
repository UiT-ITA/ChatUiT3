using System;

namespace ChatUitReact.Server.Models;

public class ChatMessage
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public AiChatRole Role { get; set; } = AiChatRole.User;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string Content { get; set; } = string.Empty;
    public AiChatStatus Status { get; set; } = AiChatStatus.Success;
    public List<ChatFile> Files { get; set; } = new List<ChatFile>();
}
