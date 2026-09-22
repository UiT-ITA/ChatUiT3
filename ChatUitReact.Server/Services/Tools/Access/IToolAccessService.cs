using System.Collections.Generic;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services.Tools;

/// <summary>
/// Decides who may use which tool. The effective policy is the stored admin override when
/// one exists, else the tool's code default. Client tools are gated as a group through the
/// <see cref="ToolRegistry.ClientToolsPolicyId"/> pseudo tool.
/// </summary>
public interface IToolAccessService
{
    Task<ToolAccessPolicy> GetEffectivePolicyAsync(string toolId);

    Task<ToolPolicy?> GetStoredPolicyAsync(string toolId);

    /// <summary>Server tools this user may pick in the assistant editor.</summary>
    Task<IReadOnlyList<ITool>> GetToolsForUserAsync(UserAccess access);

    Task<bool> CanUseAsync(ITool tool, UserAccess access);

    /// <summary>Ids (normalised) the user may not use, plus ids no tool answers to. For rejecting an assistant save.</summary>
    Task<ToolIdCheck> CheckToolIdsAsync(IEnumerable<string> toolIds, UserAccess access);

    /// <summary>The subset of stored ids the user may use right now, resolved to tools. For generation.</summary>
    Task<IReadOnlyList<ITool>> FilterAllowedAsync(IEnumerable<string> toolIds, UserAccess access);

    Task<bool> MayUseClientToolsAsync(UserAccess access);

    Task<IReadOnlyList<ToolPolicy>> GetStoredPoliciesAsync();

    Task SetOverrideAsync(string toolId, ToolAccessPolicy policy);

    Task<bool> ClearOverrideAsync(string toolId);
}

public sealed record ToolIdCheck(IReadOnlyList<string> Unknown, IReadOnlyList<string> Disallowed)
{
    public bool Ok => Unknown.Count == 0 && Disallowed.Count == 0;
}
