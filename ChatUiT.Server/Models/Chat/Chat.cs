using System.Collections.Generic;

namespace ChatUiT.Server.Models;

public class Chat : ChatHeader
{
    public List<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}
