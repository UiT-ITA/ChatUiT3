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
    // Which assistant produced this message, captured when it was created. The name is a
    // snapshot so history keeps reading correctly after the assistant is renamed or deleted.
    public string AssistantId { get; set; } = string.Empty;
    public string AssistantName { get; set; } = string.Empty;
}
