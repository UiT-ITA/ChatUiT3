using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace ChatUitReact.Server.Services.AiProviders;

using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.TokenCounting;

/// <summary>
/// One entry of the history an <see cref="AiRequest"/> carries. Chats replay earlier tool
/// calls, their results and the provider's reasoning state from each assistant message's saved
/// transcript; the Responses API gets them back from the client, because it keeps no
/// conversation of its own.
///
/// Tool fields stay out of <see cref="ChatMessage"/>, which also backs persistence.
/// </summary>
public abstract record AiInputItem
{
    /// <summary>A chat message: text and attached files, mapped as before.</summary>
    public sealed record Message(ChatMessage Value) : AiInputItem;

    /// <summary>A tool call the model made in an earlier turn.</summary>
    public sealed record ToolCall(string Id, string Name, string ArgumentsJson) : AiInputItem;

    /// <summary>
    /// The result that answered <see cref="ToolCall"/> with the same id. <paramref name="Images"/>
    /// are pictures a client tool returned with its text (the Responses API's <c>input_image</c>
    /// output parts); each protocol sends them the way its service accepts images in a tool result.
    /// <paramref name="LoadedToolIds"/> are the tools a toolbox load made callable from here on,
    /// as in <see cref="AiToolResult.LoadedToolIds"/>.
    /// </summary>
    public sealed record ToolResult(string ToolCallId, string Content, bool IsError, IReadOnlyList<ImagePart>? Images = null, IReadOnlyList<string>? LoadedToolIds = null) : AiInputItem;

    /// <summary>
    /// Provider reasoning state from an earlier turn, as that protocol emitted it in
    /// <see cref="AiStreamEvent.ReasoningState"/>. <paramref name="ModelId"/> is the model row
    /// (<see cref="Model.Id"/>); a protocol ignores state from another protocol or model row.
    /// </summary>
    public sealed record ReasoningState(ApiProtocol ApiProtocol, string ModelId, JsonElement Payload) : AiInputItem;

    public static List<AiInputItem> From(IEnumerable<ChatMessage> messages)
        => messages.Select(message => (AiInputItem)new Message(message)).ToList();
}

/// <summary>
/// The history split the way every protocol needs it: consecutive assistant-side items
/// (reasoning, assistant text, tool calls) form one native assistant turn, consecutive tool
/// results form one native result block, and every other message stands alone.
/// </summary>
internal abstract record AiInputSegment
{
    public sealed record Message(ChatMessage Value) : AiInputSegment;

    public sealed record AssistantTurn(
        IReadOnlyList<AiInputItem.ReasoningState> Reasoning,
        IReadOnlyList<ChatMessage> Messages,
        IReadOnlyList<AiInputItem.ToolCall> ToolCalls) : AiInputSegment
    {
        /// <summary>
        /// Only assistant messages: protocols map these exactly as they map chat history,
        /// message by message, so chats see no change.
        /// </summary>
        public bool IsPlainText => Reasoning.Count == 0 && ToolCalls.Count == 0;
    }

    public sealed record ToolResults(IReadOnlyList<AiInputItem.ToolResult> Results) : AiInputSegment;

    /// <param name="protocol">Reasoning state from another protocol is dropped.</param>
    /// <param name="modelRowId">Reasoning state from another model row is dropped.</param>
    public static List<AiInputSegment> Split(IReadOnlyList<AiInputItem> items, ApiProtocol protocol, string modelRowId)
    {
        var segments = new List<AiInputSegment>();
        List<AiInputItem.ReasoningState>? reasoning = null;
        List<ChatMessage>? messages = null;
        List<AiInputItem.ToolCall>? calls = null;
        List<AiInputItem.ToolResult>? results = null;

        void FlushTurn()
        {
            if (reasoning == null)
            {
                return;
            }

            segments.Add(new AssistantTurn(reasoning, messages!, calls!));
            reasoning = null;
            messages = null;
            calls = null;
        }

        void FlushResults()
        {
            if (results == null)
            {
                return;
            }

            segments.Add(new ToolResults(results));
            results = null;
        }

        void StartTurn()
        {
            FlushResults();
            if (reasoning == null)
            {
                reasoning = new List<AiInputItem.ReasoningState>();
                messages = new List<ChatMessage>();
                calls = new List<AiInputItem.ToolCall>();
            }
        }

        foreach (var item in items)
        {
            switch (item)
            {
                case AiInputItem.Message { Value.Role: AiChatRole.Assistant } assistant:
                    StartTurn();
                    messages!.Add(assistant.Value);
                    break;
                case AiInputItem.Message message:
                    FlushTurn();
                    FlushResults();
                    segments.Add(new Message(message.Value));
                    break;
                case AiInputItem.ReasoningState state:
                    StartTurn();
                    if (state.ApiProtocol == protocol && state.ModelId == modelRowId)
                    {
                        reasoning!.Add(state);
                    }
                    break;
                case AiInputItem.ToolCall call:
                    StartTurn();
                    calls!.Add(call);
                    break;
                case AiInputItem.ToolResult result:
                    FlushTurn();
                    (results ??= new List<AiInputItem.ToolResult>()).Add(result);
                    break;
            }
        }

        FlushTurn();
        FlushResults();
        return segments;
    }
}
