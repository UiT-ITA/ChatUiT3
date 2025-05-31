using System.Collections.Generic;

namespace ChatUitReact.Server.Models;

public class Chat : ChatHeader
{
    public string? AssistantId { get; set; }
    public List<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}
