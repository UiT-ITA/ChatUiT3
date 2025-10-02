using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace ChatUitReact.Server.Models;

public class ModelCapabilitiesDto
{
    [Required]
    public bool SupportsVision { get; set; }

    [Required]
    public bool SupportsReasoning { get; set; }

    [Required]
    public bool SupportsFunctionCalling { get; set; }

    [Required]
    public bool SupportsTemperature { get; set; }

    [Required]
    public int MaxContextLength { get; set; }

    [Required]
    public int MaxOutputLength { get; set; }

    [Required]
    public DateTime KnowledgeCutoff { get; set; }
}

public class ModelDto
{
    [Required]
    public string Id { get; set; } = string.Empty;

    [Required]
    public string ModelId { get; set; } = string.Empty; // Provider model identifier (e.g., "gpt-4o")

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
