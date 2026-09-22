using System.Collections.Generic;

namespace ChatUitReact.Server.Models;

/// <summary>
/// What a tool policy is evaluated against: the caller's application roles and the Entra
/// group object ids from the token. Built once per request from the claims and carried
/// into the background generation, which has no principal of its own.
/// </summary>
public sealed record UserAccess(IReadOnlyList<UserRole> Roles, IReadOnlyList<string> GroupIds)
{
    public static readonly UserAccess None = new([], []);
}
