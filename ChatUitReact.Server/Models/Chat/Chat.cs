using System.Collections.Generic;

namespace ChatUitReact.Server.Models;

public class Chat : ChatHeader
{
    public List<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}
