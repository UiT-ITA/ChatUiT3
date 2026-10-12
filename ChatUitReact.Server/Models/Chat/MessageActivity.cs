using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace ChatUitReact.Server.Models;

/// <summary>
/// What happened while an assistant message was generated: thinking summaries, tool calls,
/// and how long each took. Shown to the user next to the message and stored with it. It is
/// never part of the history sent back to the model.
/// </summary>
public class MessageActivity
{
    /// <summary>Model id the message was generated with.</summary>
    public string Model { get; set; } = string.Empty;

    public ReasoningEffort Effort { get; set; } = ReasoningEffort.None;

    /// <summary>Total time spent in thinking segments, in milliseconds.</summary>
    public long ThinkingMs { get; set; }

    /// <summary>Total time spent executing tools, in milliseconds.</summary>
    public long ToolMs { get; set; }

    /// <summary>Generation start to completion, in milliseconds.</summary>
    public long TotalMs { get; set; }

    /// <summary>How many times the model called tools and was given the results.</summary>
    public int ToolRounds { get; set; }

    public List<ActivityEntry> Entries { get; set; } = new();
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ActivityEntryType
{
    Thinking,
    Tool
}

/// <summary>One step in the generation timeline. Times are milliseconds since generation start.</summary>
public class ActivityEntry
{
    public ActivityEntryType Type { get; set; }

    public long StartedMs { get; set; }

    /// <summary>Null while the step is still running.</summary>
    public long? EndedMs { get; set; }

    /// <summary>Thinking only: the summary text, as markdown.</summary>
    public string? Text { get; set; }

    public string? ToolCallId { get; set; }

    public string? ToolName { get; set; }

    public string? ArgumentsJson { get; set; }

    public string? Result { get; set; }

    public bool IsError { get; set; }

    /// <summary>Tool only: where the tool ran.</summary>
    public ToolExecution Execution { get; set; } = ToolExecution.Server;

    /// <summary>Tool only. Persisted entries hold a terminal status.</summary>
    public ToolCallStatus Status { get; set; } = ToolCallStatus.Running;

    /// <summary>Tool only: the preview the user was shown, when the tool asked for confirmation.</summary>
    public ToolPreviewDto? Preview { get; set; }
}
