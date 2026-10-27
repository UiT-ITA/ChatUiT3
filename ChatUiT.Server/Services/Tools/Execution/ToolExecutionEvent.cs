using System;
using System.Collections.Generic;
using System.Text.Json;
using ChatUiT.Server.Models;

namespace ChatUiT.Server.Services.Tools;

/// <summary>What the executor reports while running one tool call. The runner turns these into chunks.</summary>
public abstract record ToolExecutionEvent
{
    public sealed record ConfirmationRequested(ToolPreview Preview, TimeSpan Timeout) : ToolExecutionEvent;

    public sealed record ClientCallRequested(string ArgumentsJson, TimeSpan Timeout) : ToolExecutionEvent;

    /// <summary>The call moved on without finishing: approved.</summary>
    public sealed record StatusChanged(ToolCallStatus Status, string? ArgumentsJson = null) : ToolExecutionEvent;

    public sealed record Completed(ToolResult Result, ToolCallStatus Status) : ToolExecutionEvent;

    /// <summary>
    /// <see cref="InteractionMode.Defer"/> only: the call needs the user and ends here instead of
    /// waiting. Terminal, like <see cref="Completed"/>. The caller hands the step to the client and
    /// continues it with <see cref="IToolExecutor.ResumeAsync"/> when the answer arrives.
    /// </summary>
    public sealed record Deferred(DeferredStep Step) : ToolExecutionEvent;

    /// <summary>
    /// Progress of a tool that is itself an agent: it called one of its functions. The name only;
    /// never arguments or results. Chat runners ignore it.
    /// </summary>
    public sealed record InnerCallStarted(string Name) : ToolExecutionEvent;

    /// <summary>A new part of the inner agent's reasoning summary starts. Chat runners ignore it.</summary>
    public sealed record InnerReasoningPartStarted : ToolExecutionEvent;

    /// <summary>A fragment of the current part of the inner agent's reasoning summary. Chat runners ignore it.</summary>
    public sealed record InnerReasoningDelta(string Delta) : ToolExecutionEvent;
}

/// <summary>Which step of a call waits for the user, and what it needs to continue.</summary>
public abstract record DeferredStep
{
    public sealed record Confirmation(ToolPreview Preview) : DeferredStep;
}

/// <summary>The user's answer to a <see cref="ToolExecutionEvent.Deferred"/> step, as a later request carries it.</summary>
public abstract record ResumeInput
{
    /// <summary>Confirmation approved: commit with these arguments (edited when the preview allowed it).</summary>
    public sealed record Commit(JsonElement ApprovedArguments) : ResumeInput;

    /// <summary>Confirmation rejected.</summary>
    public sealed record Declined : ResumeInput;
}

/// <summary>A user's or client's answer to a paused call, as handed to the waiting executor.</summary>
public sealed record InteractionResponse(
    ToolCallResponseKind Kind,
    ToolCallDecision? Decision,
    JsonElement? Payload,
    bool IsError);
