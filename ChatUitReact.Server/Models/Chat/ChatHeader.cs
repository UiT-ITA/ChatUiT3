using System;
using System.Collections.Generic;

namespace ChatUitReact.Server.Models;

public class ChatHeader
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string AssistantId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public AiChatStatus Status { get; set; } = AiChatStatus.Success;
    public bool IsFavorite { get; set; } = false;

    /// <summary>
    /// Whether the user has allowed red data in this chat. Without it the chat is at most yellow.
    /// Can only be switched on while the chat's assistant is red, and never switched off.
    /// </summary>
    public bool RedEnabled { get; set; } = false;

    /// <summary>
    /// On-demand assistant files the model chose to keep in context for the rest of this chat.
    /// Each is carried as a leading message on every later turn.
    /// </summary>
    public List<ChatLoadedFile> LoadedFiles { get; set; } = new();
}

public class ChatLoadedFile
{
    public string FileId { get; set; } = string.Empty;
    public string SourceFilename { get; set; } = string.Empty;

    /// <summary>Token count of the file text per counting scheme id.</summary>
    public Dictionary<string, int> TokenCounts { get; set; } = new();
}
