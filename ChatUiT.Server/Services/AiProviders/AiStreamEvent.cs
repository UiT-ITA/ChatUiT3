using System.Collections.Generic;
using System.Text.Json;

namespace ChatUiT.Server.Services.AiProviders;

/// <summary>
/// What a provider emits while streaming one turn. Deliberately small: text the user should
/// see, thinking summaries, and tool calls the runner should execute.
/// </summary>
public abstract record AiStreamEvent
{
    /// <summary>A fragment of assistant text.</summary>
    public sealed record Text(string Delta) : AiStreamEvent;

    /// <summary>A fragment of a thinking summary. Never the raw chain of thought.</summary>
    public sealed record Thinking(string Delta) : AiStreamEvent;

    /// <summary>The end of one thinking summary block or part; the next fragment starts a new paragraph.</summary>
    public sealed record ThinkingBreak : AiStreamEvent;

    /// <summary>
    /// A completed tool call. Providers accumulate their own partial-argument deltas
    /// (OpenAI streams argument fragments, Anthropic streams partial JSON) and only emit
    /// this once the call is whole.
    /// </summary>
    public sealed record ToolCall(string Id, string FunctionName, string ArgumentsJson) : AiStreamEvent;

    /// <summary>
    /// The turn's reasoning as the provider must see it again on replay (signatures, encrypted
    /// reasoning, reasoning_content), in the protocol's own shape. Emitted once, after the text
    /// and before the tool calls, when the turn had reasoning. Chat runners ignore it; the
    /// Responses API hands it to the client sealed and gets it back as
    /// <see cref="AiInputItem.ReasoningState"/>.
    /// </summary>
    public sealed record ReasoningState(JsonElement Payload) : AiStreamEvent;
}

/// <summary>
/// The provider ended a turn early: the stream reported the response as incomplete or failed,
/// or sent an error. The message carries the service's reason and is safe to show; it never
/// holds generated content.
/// </summary>
public sealed class AiTurnFailedException : Exception
{
    public AiTurnFailedException(string message) : base(message)
    {
    }
}

/// <summary>
/// The result of a tool the runner executed, on its way back to the provider.
/// <paramref name="LoadedToolIds"/> are tools of <see cref="AiRequest.LoadableTools"/> that the
/// model may call from this result on; each protocol adds their definitions here.
/// </summary>
public sealed record AiToolResult(string ToolCallId, string Content, bool IsError, IReadOnlyList<string>? LoadedToolIds = null);

/// <summary>
/// A conversation in progress. The provider owns the message list in its own SDK's shape,
/// because OpenAI and Anthropic disagree about how tool results are represented: OpenAI
/// appends a tool message to the assistant turn, Anthropic puts tool_result blocks in a
/// following user turn. Neutralising that would push tool fields into
/// <see cref="ChatUiT.Server.Models.ChatMessage"/>, which also backs persistence.
/// </summary>
public interface IAiConversation
{
    /// <summary>
    /// Streams one assistant turn. Completing the enumeration ends the turn. With
    /// <paramref name="allowToolCalls"/> false the tools stay declared, so the history and the
    /// tool set are unchanged, but the model is told it may not call them and has to answer.
    /// </summary>
    IAsyncEnumerable<AiStreamEvent> StreamTurnAsync(bool allowToolCalls = true, CancellationToken cancellationToken = default);

    /// <summary>Appends tool results so the next <see cref="StreamTurnAsync"/> continues from them.</summary>
    void AppendToolResults(IReadOnlyList<AiToolResult> results);
}
