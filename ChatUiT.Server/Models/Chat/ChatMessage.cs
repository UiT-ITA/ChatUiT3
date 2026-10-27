using System;

namespace ChatUiT.Server.Models;

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
    /// <summary>
    /// Activity recorded while an assistant message was generated. Null on user messages
    /// and on assistant messages that have no recorded activity.
    /// </summary>
    public MessageActivity? Activity { get; set; }
    /// <summary>
    /// Assistant messages only: what the model produced and received while generating this
    /// message, replayed on later turns. Null on messages saved before transcripts existed.
    /// </summary>
    public List<TranscriptItem>? Transcript { get; set; }
    // Scheme id → tokens this message costs on the wire, as the OpenAI provider would send it.
    // A missing key means "not yet counted", never zero.
    public Dictionary<string, int> TokenCounts { get; set; } = new();
    // Scheme id → the share of TokenCounts spent on attachments (wrapper text, file text,
    // images). Empty when the message has no files.
    public Dictionary<string, int> FileTokenCounts { get; set; } = new();
}
