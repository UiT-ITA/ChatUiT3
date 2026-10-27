using System;
using System.Collections.Generic;
using System.Linq;

namespace ChatUiT.Server.Models;

/// <summary>
/// Who may use a tool. A user passes when the tool is enabled and holds any listed role or
/// belongs to any listed group. Both lists empty means nobody; every authenticated user
/// holds <see cref="UserRole.User"/>, so listing that role means everybody.
/// </summary>
public sealed class ToolAccessPolicy
{
    public bool Enabled { get; init; } = true;

    public IReadOnlyList<UserRole> AllowedRoles { get; init; } = [];

    /// <summary>Entra ID group object ids.</summary>
    public IReadOnlyList<string> AllowedGroupIds { get; init; } = [];

    public static readonly ToolAccessPolicy Everyone = new() { AllowedRoles = [UserRole.User] };

    public static ToolAccessPolicy ForRoles(params UserRole[] roles) => new() { AllowedRoles = roles };

    public bool Allows(UserAccess access)
    {
        if (!Enabled)
        {
            return false;
        }

        return AllowedRoles.Any(access.Roles.Contains)
            || AllowedGroupIds.Any(id => access.GroupIds.Contains(id, StringComparer.OrdinalIgnoreCase));
    }
}

/// <summary>A stored override of a tool's code default, keyed by tool id.</summary>
public sealed class ToolPolicy
{
    public required string ToolId { get; init; }

    public required ToolAccessPolicy Policy { get; init; }

    public DateTime UpdatedAt { get; init; } = DateTime.UtcNow;
}
