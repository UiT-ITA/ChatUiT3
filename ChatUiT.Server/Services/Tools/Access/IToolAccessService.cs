using System.Collections.Generic;
using System.Threading.Tasks;
using ChatUiT.Server.Models;

namespace ChatUiT.Server.Services.Tools;

/// <summary>
/// Decides who may use which toolbox. The effective policy is the stored admin override when
/// one exists, else the toolbox's code default. A child toolbox is usable when its own policy and
/// its parent's allow the user. A tool is usable when any toolbox that holds it is. Client tools are gated as a group through the <see cref="ToolRegistry.ClientToolsPolicyId"/>
/// pseudo id.
/// </summary>
public interface IToolAccessService
{
    Task<ToolAccessPolicy> GetEffectivePolicyAsync(string toolboxId);

    Task<ToolPolicy?> GetStoredPolicyAsync(string toolboxId);

    /// <summary>Top-level toolboxes this user may pick in the assistant editor.</summary>
    Task<IReadOnlyList<IToolbox>> GetToolboxesForUserAsync(UserAccess access);

    Task<bool> CanUseAsync(IToolbox toolbox, UserAccess access);

    /// <summary>
    /// Whether the user may run the tool: a client tool by the client tools policy, a tool in
    /// toolboxes when any of them allows the user, any other tool by its own default.
    /// </summary>
    Task<bool> CanUseAsync(ITool tool, UserAccess access);

    /// <summary>Toolbox ids the user may not use, plus invalid ids (see <see cref="IToolboxRegistry.Invalid"/>). For rejecting an assistant save.</summary>
    Task<ToolIdCheck> CheckToolIdsAsync(IEnumerable<string> toolboxIds, UserAccess access);

    /// <summary>The stored ids the user may use right now, resolved to top-level toolboxes. For generation.</summary>
    Task<IReadOnlyList<ResolvedToolbox>> FilterAllowedAsync(IEnumerable<string> toolboxIds, UserAccess access);

    Task<bool> MayUseClientToolsAsync(UserAccess access);

    Task<IReadOnlyList<ToolPolicy>> GetStoredPoliciesAsync();

    Task SetOverrideAsync(string toolboxId, ToolAccessPolicy policy);

    Task<bool> ClearOverrideAsync(string toolboxId);
}

public sealed record ToolIdCheck(IReadOnlyList<string> Invalid, IReadOnlyList<string> Disallowed)
{
    public bool Ok => Invalid.Count == 0 && Disallowed.Count == 0;
}
