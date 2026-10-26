using System;
using System.Collections.Generic;

namespace ChatUitReact.Server.Models;

/// <summary>
/// The user-facing view of a model's capabilities. Deliberately narrower than
/// <see cref="ModelCapabilitiesDto"/>: it drives which controls the assistant form shows
/// and carries no provider or endpoint detail.
/// </summary>
public class UserModelCapabilitiesDto
{
    public bool Vision { get; set; }
    public bool Tools { get; set; }

    /// <summary>"Unsupported" | "Supported" | "SupportedWhenReasoningDisabled".</summary>
    public TemperatureSupport Temperature { get; set; }

    /// <summary>Ascending list of accepted reasoning levels; empty when the model does not reason.</summary>
    public List<ReasoningEffort> SupportedEfforts { get; set; } = new List<ReasoningEffort>();

    public int ContextSize { get; set; }
    public int MaxOutputTokens { get; set; }

    /// <summary>Month-year string (e.g., "2025-08"), or null when unknown.</summary>
    public string? KnowledgeCutoff { get; set; }

    /// <summary>
    /// Which key to read from message and assistant token counts, and how to count the
    /// draft. Null when the model has no counter.
    /// </summary>
    public string? TokenCountingScheme { get; set; }
}

public class UserModelDto
{
    public string Id { get; set; } = string.Empty;
    public string ModelName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Whether an assistant on this model may be pinned as the user's default assistant.
    /// Sits on the model, not on <see cref="UserModelCapabilitiesDto"/>, because it is
    /// operator policy rather than something the model can or cannot do.
    /// </summary>
    public bool AllowedAsDefault { get; set; }

    public DataClassification Classification { get; set; }

    public UserModelCapabilitiesDto Capabilities { get; set; } = new UserModelCapabilitiesDto();
}
