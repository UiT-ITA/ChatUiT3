using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Text.Json;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services.Tools;

/// <summary>What the executor reports while running one tool call. The runner turns these into chunks.</summary>
public abstract record ToolExecutionEvent
{
    public sealed record ConfirmationRequested(ToolPreview Preview, TimeSpan Timeout) : ToolExecutionEvent;

    public sealed record ClientCallRequested(string ArgumentsJson, TimeSpan Timeout) : ToolExecutionEvent;

    public sealed record ConsentRequired(IReadOnlyList<string> Scopes, TimeSpan Timeout) : ToolExecutionEvent;

    /// <summary>The call moved on without finishing: approved, or running again after consent.</summary>
    public sealed record StatusChanged(ToolCallStatus Status, string? ArgumentsJson = null) : ToolExecutionEvent;

    public sealed record Completed(ToolResult Result, ToolCallStatus Status) : ToolExecutionEvent;
}

/// <summary>A user's or client's answer to a paused call, as handed to the waiting executor.</summary>
public sealed record InteractionResponse(
    ToolCallResponseKind Kind,
    ToolCallDecision? Decision,
    JsonElement? Payload,
    bool IsError,
    ClaimsPrincipal? User,
    string? IncomingToken = null);
