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
    /// <summary>The tool call waits for the user to approve or reject it.</summary>
    ToolConfirmationRequested,
    /// <summary>The tool call waits for the client to run the tool and post the result.</summary>
    ToolClientCallRequested,
    /// <summary>A tool call changed status without finishing (approved).</summary>
    ToolStatus,
    /// <summary>The tool call waits for the user to answer questions.</summary>
    ToolQuestionRequested,
    /// <summary>
    /// The run ended on calls that wait; carries the <see cref="MessageActivity"/> so far. The
    /// message continues on a new stream once every waiting call has its answer.
    /// </summary>
    AwaitingUser,
    /// <summary>First chunk of a run that continues a message that waited; carries its <see cref="MessageActivity"/> so far.</summary>
    Continued
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

    /// <summary>ToolQuestionRequested.</summary>
    public List<UserQuestionDto>? Questions { get; set; }
}

/// <summary>What the user sees before approving a confirmable tool call. Also stored on the activity entry.</summary>
public class ToolPreviewDto
{
    public string Title { get; set; } = string.Empty;

    /// <summary>Markdown, optional.</summary>
    public string? Summary { get; set; }

    public List<ToolPreviewFieldDto> Fields { get; set; } = new();

    public bool AllowEdit { get; set; } = true;

    public ToolPreviewKind Kind { get; set; } = ToolPreviewKind.General;
}

public class ToolPreviewFieldDto
{
    public string Label { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public bool Multiline { get; set; }
    public ToolPreviewFieldRole Role { get; set; } = ToolPreviewFieldRole.None;
}
