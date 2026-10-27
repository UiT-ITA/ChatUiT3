using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace ChatUiT.Server.Models;

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
    Done,
    /// <summary>The run is paused until the user approves or rejects the tool call.</summary>
    ToolConfirmationRequested,
    /// <summary>The run is paused until the client runs the tool and posts the result.</summary>
    ToolClientCallRequested,
    /// <summary>A tool call changed status without finishing (approved).</summary>
    ToolStatus
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

    /// <summary>ToolStart: where the tool runs.</summary>
    public ToolExecution? Execution { get; set; }

    /// <summary>ToolStatus and ToolEnd.</summary>
    public ToolCallStatus? Status { get; set; }

    /// <summary>ToolConfirmationRequested.</summary>
    public ToolPreviewDto? Preview { get; set; }

    /// <summary>On the pause kinds: how long the server waits, counted from this chunk's <see cref="ElapsedMs"/>.</summary>
    public long? TimeoutMs { get; set; }
}

/// <summary>What the user sees before approving a confirmable tool call. Also stored on the activity entry.</summary>
public class ToolPreviewDto
{
    public string Title { get; set; } = string.Empty;

    /// <summary>Markdown, optional.</summary>
    public string? Summary { get; set; }

    public List<ToolPreviewFieldDto> Fields { get; set; } = new();

    public bool AllowEdit { get; set; } = true;
}

public class ToolPreviewFieldDto
{
    public string Label { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public bool Multiline { get; set; }
}
