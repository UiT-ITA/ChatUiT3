using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace ChatUitReact.Server.Models;

public class ModelCapabilitiesDto
{
    [Required]
    public bool SupportsVision { get; set; }

    [Required]
    public bool SupportsFunctionCalling { get; set; }

    /// <summary>"Unsupported" | "Supported" | "SupportedWhenReasoningDisabled".</summary>
    [Required]
    public TemperatureSupport Temperature { get; set; }

    /// <summary>
    /// Ascending list of accepted reasoning levels. Empty means the model does not reason;
    /// omitting "None" means reasoning cannot be switched off.
    /// </summary>
    [Required]
    public List<ReasoningEffort> SupportedEfforts { get; set; } = new List<ReasoningEffort>();

    [Required]
    public int MaxContextTokens { get; set; }

    [Required]
    public int MaxOutputTokens { get; set; }

    [Required]
    public int DefaultMaxOutputTokens { get; set; }

    /// <summary>Null when unknown.</summary>
    public DateTime? KnowledgeCutoff { get; set; }
}

public class ModelDto
{
    [Required]
    public string Id { get; set; } = string.Empty;

    [Required]
    public string ModelId { get; set; } = string.Empty; // Provider model identifier (e.g., "gpt-5.4")

    [Required]
    public string ModelName { get; set; } = string.Empty; // Friendly/display name

    [Required]
    public string Description { get; set; } = string.Empty;

    [Required]
    public string EndpointId { get; set; } = string.Empty;

    [Required]
    public List<UserRole> AllowedRoles { get; set; } = new List<UserRole>();

    [Required]
    public ModelCapabilitiesDto Capabilities { get; set; } = new ModelCapabilitiesDto();
}

public class CreateModelDto
{
    [Required]
    public string ModelId { get; set; } = string.Empty; // Provider model identifier

    [Required]
    public string ModelName { get; set; } = string.Empty; // Friendly/display name

    [Required]
    public string Description { get; set; } = string.Empty;

    [Required]
    public string EndpointId { get; set; } = string.Empty;

    [Required]
    public List<UserRole> AllowedRoles { get; set; } = new List<UserRole>();

    [Required]
    public ModelCapabilitiesDto Capabilities { get; set; } = new ModelCapabilitiesDto();
}

public class UpdateModelDto
{
    [Required]
    public string Id { get; set; } = string.Empty;

    [Required]
    public string ModelId { get; set; } = string.Empty; // Provider model identifier

    [Required]
    public string ModelName { get; set; } = string.Empty; // Friendly/display name

    [Required]
    public string Description { get; set; } = string.Empty;

    [Required]
    public string EndpointId { get; set; } = string.Empty;

    [Required]
    public List<UserRole> AllowedRoles { get; set; } = new List<UserRole>();

    [Required]
    public ModelCapabilitiesDto Capabilities { get; set; } = new ModelCapabilitiesDto();
}
