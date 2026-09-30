using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Agents;

namespace ChatUitReact.Server.Services.Tools;

public static class ToolMapping
{
    public static ToolDto ToDto(ITool tool) => new()
    {
        Id = tool.Id,
        Name = tool.DisplayName,
        Description = tool.Description,
        RequiresConfirmation = tool is IConfirmableTool,
        RequiredScopes = tool.RequiredScopes.ToList(),
        Execution = tool.Execution
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

    public static ToolAdminDto ToAdminDto(ITool tool, ToolAccessPolicy effective, ToolPolicy? stored) => new()
    {
        Id = tool.Id,
        Name = tool.DisplayName,
        Description = tool.Description,
        RequiresConfirmation = tool is IConfirmableTool,
        RequiredScopes = tool.RequiredScopes.ToList(),
        Execution = tool.Execution,
        ParametersSchema = JsonSerializer.SerializeToElement(tool.ParametersSchema),
        DefaultPolicy = ToDto(tool.DefaultPolicy),
        Policy = ToDto(effective),
        IsOverridden = stored != null,
        UpdatedAt = stored?.UpdatedAt,
        Functions = tool is InternalAgentTool agentTool ? ToFunctionDtos(agentTool.Agent) : null
    };

    public static List<ToolFunctionDto> ToFunctionDtos(InternalAgent agent) => agent.Functions.Select(f => new ToolFunctionDto
    {
        Id = f.Id,
        Description = f.Description,
        RequiresConfirmation = f is IConfirmableTool,
        RequiredScopes = f.RequiredScopes.ToList()
    }).ToList();
}
