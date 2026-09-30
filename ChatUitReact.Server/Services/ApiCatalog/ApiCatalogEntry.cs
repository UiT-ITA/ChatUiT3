using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services.ApiCatalog;

[JsonConverter(typeof(CamelCaseEnumConverter))]
public enum ApiCatalogKind
{
    /// <summary>An <see cref="Agents.InternalAgent"/>, served on the model set for it under Internal agents.</summary>
    Agent,

    /// <summary>A model row, served as it is.</summary>
    Model
}

/// <summary>
/// One "model" of the Responses API: an agent or a raw model an admin exposed, and who may use
/// it. The entry's policy is only the first gate; the target's own access rules apply as well
/// (see <see cref="ApiCatalogService"/>).
/// </summary>
public sealed partial class ApiCatalogEntry
{
    [GeneratedRegex("^[a-z0-9][a-z0-9._-]{0,63}$")]
    public static partial Regex PublicIdPattern();

    /// <summary>The id clients send as <c>model</c>. Matches <c>^[a-z0-9][a-z0-9._-]{0,63}$</c>; an agent's is its id.</summary>
    public required string PublicId { get; init; }

    public required ApiCatalogKind Kind { get; init; }

    /// <summary>The internal agent id, or the <see cref="Model.Id"/> of the model row.</summary>
    public required string TargetId { get; init; }

    public bool Enabled { get; init; }

    public IReadOnlyList<UserRole> AllowedRoles { get; init; } = [];

    /// <summary>Entra ID group object ids.</summary>
    public IReadOnlyList<string> AllowedGroupIds { get; init; } = [];

    public DateTime UpdatedAt { get; init; } = DateTime.UtcNow;

    /// <summary>Same rule as a tool policy: enabled, and any listed role or any listed group.</summary>
    public bool Allows(UserAccess access) => new ToolAccessPolicy
    {
        Enabled = Enabled,
        AllowedRoles = AllowedRoles,
        AllowedGroupIds = AllowedGroupIds
    }.Allows(access);
}
