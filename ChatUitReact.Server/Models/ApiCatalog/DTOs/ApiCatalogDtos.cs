using System;
using System.Collections.Generic;
using ChatUitReact.Server.Services.ApiCatalog;

namespace ChatUitReact.Server.Models;

/// <summary>One Responses API catalog entry as the admin panel edits it.</summary>
public class ApiCatalogEntryDto
{
    public string PublicId { get; set; } = string.Empty;
    public ApiCatalogKind Kind { get; set; }
    /// <summary>The internal agent id, or the model row id (<c>Model.Id</c>).</summary>
    public string TargetId { get; set; } = string.Empty;
    public bool Enabled { get; set; }
    public List<UserRole> AllowedRoles { get; set; } = new();
    public List<string> AllowedGroupIds { get; set; } = new();
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>An internal agent that can be exposed. Its public id is its id.</summary>
public class ApiCatalogAgentDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> ToolIds { get; set; } = new();
    public ToolAccessPolicyDto DefaultPolicy { get; set; } = new();
}

/// <summary>A model row that can be exposed.</summary>
public class ApiCatalogModelDto
{
    public string Id { get; set; } = string.Empty;
    public string ModelName { get; set; } = string.Empty;
    public string ModelId { get; set; } = string.Empty;
}

public class ApiCatalogDto
{
    public List<ApiCatalogEntryDto> Entries { get; set; } = new();
    public List<ApiCatalogAgentDto> Agents { get; set; } = new();
    public List<ApiCatalogModelDto> Models { get; set; } = new();
}
