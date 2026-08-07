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
}

public class UserModelDto
{
    public string Id { get; set; } = string.Empty;
    public string ModelName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public UserModelCapabilitiesDto Capabilities { get; set; } = new UserModelCapabilitiesDto();
}
