using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ChatUiT.Server.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TranscriptItemKind
{
    Reasoning,
    Text,
    ToolCall,
    ToolResult
}

/// <summary>
/// One step of an assistant message as the model produced and received it, in order: each
/// round's reasoning state, text and tool calls, then the tool results. Saved on the message and
/// replayed on later turns in place of its text. Never sent to the client.
/// </summary>
public sealed class TranscriptItem
{
    public TranscriptItemKind Kind { get; set; }

    /// <summary>Reasoning: the protocol that emitted the state.</summary>
    public ApiProtocol? Protocol { get; set; }

    /// <summary>Reasoning: the model row (<see cref="Model.Id"/>) that emitted the state.</summary>
    public string? ModelId { get; set; }

    /// <summary>Reasoning: the state in the protocol's own shape.</summary>
    public JsonElement? Payload { get; set; }

    /// <summary>Text: the assistant text of one round.</summary>
    public string? Text { get; set; }

    /// <summary>Tool call and tool result.</summary>
    public string? ToolCallId { get; set; }

    /// <summary>Tool call: the function name.</summary>
    public string? Name { get; set; }

    /// <summary>Tool call.</summary>
    public string? ArgumentsJson { get; set; }

    /// <summary>Tool result: the content the model got.</summary>
    public string? Content { get; set; }

    /// <summary>Tool result.</summary>
    public bool IsError { get; set; }

    /// <summary>Tool result of a toolbox load: the tools it made callable.</summary>
    public List<string>? LoadedToolIds { get; set; }

    /// <summary>Tool result: the images the model got.</summary>
    public List<TranscriptImage>? Images { get; set; }
}

public sealed class TranscriptImage
{
    public string Base64 { get; set; } = string.Empty;

    public string MediaType { get; set; } = string.Empty;
}
