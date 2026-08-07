using System.Collections.Generic;

namespace ChatUitReact.Server.Services.AiProviders;

/// <summary>
/// What a provider emits while streaming one turn. Deliberately small: text the user should
/// see, tool calls the runner should execute, and the end of the turn.
/// </summary>
public abstract record AiStreamEvent
{
    /// <summary>A fragment of assistant text.</summary>
    public sealed record Text(string Delta) : AiStreamEvent;

    /// <summary>
    /// A completed tool call. Providers accumulate their own partial-argument deltas
    /// (OpenAI streams argument fragments, Anthropic streams partial JSON) and only emit
    /// this once the call is whole.
    /// </summary>
    public sealed record ToolCall(string Id, string FunctionName, string ArgumentsJson) : AiStreamEvent;
}

/// <summary>The result of a tool the runner executed, on its way back to the provider.</summary>
public sealed record AiToolResult(string ToolCallId, string Content, bool IsError);

/// <summary>
/// A conversation in progress. The provider owns the message list in its own SDK's shape,
/// because OpenAI and Anthropic disagree about how tool results are represented: OpenAI
/// appends a tool message to the assistant turn, Anthropic puts tool_result blocks in a
/// following user turn. Neutralising that would push tool fields into
/// <see cref="ChatUitReact.Server.Models.ChatMessage"/>, which also backs persistence.
/// </summary>
public interface IAiConversation
{
    /// <summary>Streams one assistant turn. Completing the enumeration ends the turn.</summary>
    IAsyncEnumerable<AiStreamEvent> StreamTurnAsync(CancellationToken cancellationToken = default);

    /// <summary>Appends tool results so the next <see cref="StreamTurnAsync"/> continues from them.</summary>
    void AppendToolResults(IReadOnlyList<AiToolResult> results);
}
