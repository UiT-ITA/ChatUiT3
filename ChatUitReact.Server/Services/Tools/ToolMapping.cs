using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services.Tools;

public static class ToolMapping
{
    public static ToolDto ToDto(IToolbox toolbox, List<ToolDto> children) => new()
    {
        Id = toolbox.Id,
        Name = toolbox.DisplayName,
        Description = toolbox.Description,
        RequiresConfirmation = toolbox.Tools.Any(t => t is IConfirmableTool),
        RequiredScopes = RequiredScopes(toolbox),
        Execution = ToolExecution.Server,
        Classification = toolbox.Classification,
        Children = children
    };

    public static ToolAccessPolicyDto ToDto(ToolAccessPolicy policy) => new()
    {
        Enabled = policy.Enabled,
        AllowedRoles = policy.AllowedRoles.ToList(),
        AllowedGroupIds = policy.AllowedGroupIds.ToList()
    };

    public static ToolAccessPolicy ToPolicy(ToolAccessPolicyDto dto) => new()
    {
        Enabled = dto.Enabled,
        AllowedRoles = dto.AllowedRoles?.Distinct().ToList() ?? [],
        AllowedGroupIds = dto.AllowedGroupIds?.Select(id => id.Trim()).Where(id => id.Length > 0).Distinct().ToList() ?? []
    };

    /// <summary>A toolbox of one tool shows that tool's schema; a larger toolbox lists its functions.</summary>
    public static ToolAdminDto ToAdminDto(IToolbox toolbox, IToolbox? parent, ToolAccessPolicy effective, ToolPolicy? stored) => new()
    {
        Id = toolbox.Id,
        ParentId = parent?.Id,
        Name = toolbox.DisplayName,
        Description = toolbox.Description,
        RequiresConfirmation = toolbox.Tools.Any(t => t is IConfirmableTool),
        RequiredScopes = RequiredScopes(toolbox),
        Execution = ToolExecution.Server,
        Classification = toolbox.Classification,
        ParametersSchema = toolbox.Tools is [var only] ? JsonSerializer.SerializeToElement(only.ParametersSchema) : null,
        DefaultPolicy = ToDto(toolbox.DefaultPolicy),
        Policy = ToDto(effective),
        IsOverridden = stored != null,
        UpdatedAt = stored?.UpdatedAt,
        Functions = toolbox.Tools.Count > 1 ? ToFunctionDtos(toolbox.Tools) : null
    };

    public static List<ToolFunctionDto> ToFunctionDtos(IEnumerable<ITool> tools) => tools.Select(f => new ToolFunctionDto
    {
        Id = f.Id,
        Description = f.Description,
        RequiresConfirmation = f is IConfirmableTool,
        RequiredScopes = f.RequiredScopes.ToList(),
        Classification = f.Classification
    }).ToList();

    private static List<string> RequiredScopes(IToolbox toolbox)
        => toolbox.Tools.SelectMany(t => t.RequiredScopes).Distinct().ToList();
}
