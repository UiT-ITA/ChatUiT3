namespace ChatUitReact.Server.Models;

public class ChatResponseChunk
{
    public string Content { get; set; } = "";
    public bool IsComplete { get; set; } = false;
}
