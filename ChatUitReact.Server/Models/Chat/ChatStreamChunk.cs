using System.Text.Json.Serialization;

namespace ChatUitReact.Server.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ChatStreamChunkKind
{
    /// <summary>A fragment of the message text.</summary>
    Text,
    /// <summary>A fragment of a thinking summary.</summary>
    Thinking,
    /// <summary>A tool call is about to run.</summary>
    ToolStart,
    /// <summary>A tool call finished.</summary>
    ToolEnd,
    /// <summary>Generation finished; carries the final <see cref="MessageActivity"/>.</summary>
    Done
}

/// <summary>
/// One event on a message's live stream, from the runner through SignalR to the client.
/// <see cref="ElapsedMs"/> is measured on the server so replayed streams show the same
/// timings as live ones.
/// </summary>
public class ChatStreamChunk
{
    public ChatStreamChunkKind Kind { get; set; }

    public long ElapsedMs { get; set; }

    /// <summary>Text or thinking delta.</summary>
    public string? Text { get; set; }

    public string? ToolCallId { get; set; }

    public string? ToolName { get; set; }

    public string? ArgumentsJson { get; set; }

    public string? Result { get; set; }

    public bool IsError { get; set; }

    public MessageActivity? Activity { get; set; }
}
