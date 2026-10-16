using System.Collections.Generic;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services.Tools;

/// <summary>
/// Decides who may use which toolbox. The effective policy is the stored admin override when
/// one exists, else the toolbox's code default. A tool is usable when any toolbox that holds it
/// is. Client tools are gated as a group through the <see cref="ToolRegistry.ClientToolsPolicyId"/>
/// pseudo id.
/// </summary>
public interface IToolAccessService
{
    Task<ToolAccessPolicy> GetEffectivePolicyAsync(string toolboxId);

    Task<ToolPolicy?> GetStoredPolicyAsync(string toolboxId);

    /// <summary>Toolboxes this user may pick in the assistant editor.</summary>
    Task<IReadOnlyList<IToolbox>> GetToolboxesForUserAsync(UserAccess access);

    Task<bool> CanUseAsync(IToolbox toolbox, UserAccess access);

    /// <summary>
    /// Whether the user may run the tool: a client tool by the client tools policy, a tool in
    /// toolboxes when any of them allows the user, any other tool by its own default.
    /// </summary>
    Task<bool> CanUseAsync(ITool tool, UserAccess access);

    /// <summary>Toolbox ids (legacy ids expanded) the user may not use, plus ids no toolbox answers to. For rejecting an assistant save.</summary>
    Task<ToolIdCheck> CheckToolIdsAsync(IEnumerable<string> toolboxIds, UserAccess access);

    /// <summary>The stored ids the user may use right now, resolved to toolboxes. For generation.</summary>
    Task<IReadOnlyList<IToolbox>> FilterAllowedAsync(IEnumerable<string> toolboxIds, UserAccess access);

    Task<bool> MayUseClientToolsAsync(UserAccess access);

    Task<IReadOnlyList<ToolPolicy>> GetStoredPoliciesAsync();

    Task SetOverrideAsync(string toolboxId, ToolAccessPolicy policy);

    Task<bool> ClearOverrideAsync(string toolboxId);
}

public sealed record ToolIdCheck(IReadOnlyList<string> Unknown, IReadOnlyList<string> Disallowed)
{
    public bool Ok => Unknown.Count == 0 && Disallowed.Count == 0;
}
