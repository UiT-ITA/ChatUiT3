using System.Collections.Generic;
using System.Linq;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services.Tools;

/// <summary>
/// A named set of tools. Assistants select toolboxes, access policies are set on toolboxes, and
/// the model loads a toolbox in a chat through <see cref="LoadToolsTool"/>. A tool may be in
/// more than one toolbox.
///
/// <see cref="Id"/> follows the tool id rule and is what assistants store in their available
/// tool ids.
/// </summary>
public interface IToolbox
{
    string Id { get; }

    /// <summary>Shown to people in the assistant editor and the admin panel.</summary>
    string DisplayName { get; }

    /// <summary>Written for the model: what the toolbox covers. Also shown to people.</summary>
    string Description { get; }

    /// <summary>Who may use the toolbox when no override is stored.</summary>
    ToolAccessPolicy DefaultPolicy { get; }

    IReadOnlyList<ITool> Tools { get; }

    /// <summary>Ids assistants stored before this toolbox existed. One legacy id may map to several toolboxes.</summary>
    IReadOnlyList<string> LegacyIds { get; }
}

public sealed class Toolbox : IToolbox
{
    public required string Id { get; init; }

    public required string DisplayName { get; init; }

    public required string Description { get; init; }

    public ToolAccessPolicy DefaultPolicy { get; init; } = ToolAccessPolicy.Everyone;

    public required IReadOnlyList<ITool> Tools { get; init; }

    public IReadOnlyList<string> LegacyIds { get; init; } = [];

    /// <summary>A toolbox holding one tool, under the tool's own id, name, description, policy and legacy ids.</summary>
    public static Toolbox Of(ITool tool) => new()
    {
        Id = tool.Id,
        DisplayName = tool.DisplayName,
        Description = tool.Description,
        DefaultPolicy = tool.DefaultPolicy,
        Tools = [tool],
        LegacyIds = tool.LegacyIds.ToList()
    };
}
