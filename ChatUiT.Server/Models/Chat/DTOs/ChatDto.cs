using System;
using System.Collections.Generic;
using System.Linq;

namespace ChatUiT.Server.Models;

public class ChatHeaderDto
{
    public string Id { get; set; } = string.Empty;
    public string AssistantId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public AiChatStatus Status { get; set; }
    public bool IsFavorite { get; set; }
    public bool RedEnabled { get; set; }
    public List<ChatLoadedFileDto> LoadedFiles { get; set; } = new();
}

public class ChatLoadedFileDto
{
    public string FileId { get; set; } = string.Empty;
    public string SourceFilename { get; set; } = string.Empty;
    public Dictionary<string, int> TokenCounts { get; set; } = new();
}

public class ChatDto : ChatHeaderDto
{
    public List<ChatMessageDto> Messages { get; set; } = new List<ChatMessageDto>();
}

public class ChatMessageDto
{
    public string Id { get; set; } = string.Empty;
    public AiChatRole Role { get; set; }
    public DateTime Timestamp { get; set; }
    public string Content { get; set; } = string.Empty;
    public AiChatStatus Status { get; set; }
    public List<ChatFileDto> Files { get; set; } = new List<ChatFileDto>();
    public string AssistantId { get; set; } = string.Empty;
    public string AssistantName { get; set; } = string.Empty;
    public MessageActivity? Activity { get; set; }
    /// <summary>Token counting scheme id → tokens. A missing key means not yet counted.</summary>
    public Dictionary<string, int> TokenCounts { get; set; } = new();
    /// <summary>The attachment share of <see cref="TokenCounts"/>; empty when the message has no files.</summary>
    public Dictionary<string, int> FileTokenCounts { get; set; } = new();
}

public class ChatFileChunkDto
{
    public string Type { get; set; } = string.Empty;
    public string? Text { get; set; }
    public string? Format { get; set; }
    public string? Base64 { get; set; }
}

/// <summary>
/// A file with its parts. A chat carries the parts without their text and image data. The
/// file's own endpoint gives them with it.
/// </summary>
public class ChatFileDto
{
    public string Id { get; set; } = string.Empty;
    public string SourceFilename { get; set; } = string.Empty;
    public List<ChatFileChunkDto> Chunks { get; set; } = new List<ChatFileChunkDto>();

    // Switched off in stage 1: how the original is shown. See FilePreviews.
    // public string Preview { get; set; } = string.Empty;

    public static ChatFileDto From(ChatFile file, bool includeContent) => new()
    {
        Id = file.Id,
        SourceFilename = file.SourceFilename,
        Chunks = file.Chunks.Select(chunk => ChunkFrom(chunk, includeContent)).ToList()
        // Preview = Services.Files.FilePreviews.KindOf(file)
    };

    public static ChatFileChunkDto ChunkFrom(ChatFileChunk chunk, bool includeContent) => new()
    {
        Type = chunk.Type,
        Format = chunk.Format,
        Text = includeContent ? chunk.Text : null,
        Base64 = includeContent && chunk.Data != null ? Convert.ToBase64String(chunk.Data) : null
    };
}

public class CreateChatDto
{
    public string AssistantId { get; set; } = string.Empty;

    /// <summary>Allows red data from the start. Requires a red assistant.</summary>
    public bool RedEnabled { get; set; }
}

public class UpdateChatDto
{
    public string? Name { get; set; }
    public bool? IsFavorite { get; set; }

    /// <summary>True allows red data and requires a red assistant. Once on it cannot be switched off.</summary>
    public bool? RedEnabled { get; set; }

    /// <summary>
    /// With <see cref="RedEnabled"/>: the assistant the user has picked but not sent to yet. The
    /// chat switches to it, and it is the one that must be red. Absent means the chat's own assistant.
    /// </summary>
    public string? AssistantId { get; set; }
}

/// <summary>The text of a new message. Its files are uploaded to it before it is sent.</summary>
public class CreateMessageDto
{
    public string Content { get; set; } = string.Empty;
}

/// <summary>Sends a message that was created, with its files uploaded, and starts the reply.</summary>
public class SendMessageDto
{
    public string AssistantId { get; set; } = string.Empty;

    /// <summary>Tools the client offers to run itself for this message. Not stored.</summary>
    public List<ClientToolDeclarationDto>? ClientTools { get; set; }

    /// <summary>The client's IANA time zone, for knowledge sources that depend on "today". Not stored.</summary>
    public string? TimeZone { get; set; }

    /// <summary>Answers the user had given to the calls the chat waits on, sent with this message instead of on their own.</summary>
    public List<PendingAnswerDto>? Answers { get; set; }
}

