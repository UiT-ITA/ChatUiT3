using System.Collections.Generic;

namespace ChatUitReact.Server.Services.AiProviders;

using ChatUitReact.Server.Models;

/// <summary>
/// A request's parameters after they have been reconciled with what the model actually
/// supports. Providers translate this into their own wire format and are not expected to
/// re-check capabilities — if a value is here, it is safe to send.
/// </summary>
public sealed record ResolvedChatParameters
{
    /// <summary>Null when the model must not receive a temperature at all.</summary>
    public float? Temperature { get; init; }

    /// <summary><see cref="ReasoningEffort.None"/> when no reasoning should be requested.</summary>
    public ReasoningEffort Effort { get; init; } = ReasoningEffort.None;

    /// <summary>Always set — Anthropic requires max_tokens on every request.</summary>
    public int MaxOutputTokens { get; init; }

    /// <summary>Empty when the model cannot call tools.</summary>
    public IReadOnlyList<string> ToolIds { get; init; } = new List<string>();

    /// <summary>False when image attachments must be reduced to a text note.</summary>
    public bool AllowImages { get; init; }

    public bool ReasoningActive => Effort != ReasoningEffort.None;
}
