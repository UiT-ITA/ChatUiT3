using System.Collections.Generic;
using System.Linq;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services.Tools;

/// <summary>
/// A named set of tools with its own access policy. Assistants select toolboxes and the model
/// loads a top-level toolbox in a chat through <see cref="LoadToolsTool"/>. A toolbox may hold
/// child toolboxes: the assistant editor shows them as options under their parent, and loading
/// the parent adds the tools of its selected children. A tool may be in more than one toolbox.
///
/// <see cref="Id"/> follows the tool id rule, is unique across all toolboxes including children,
/// and is what assistants store in their available tool ids.
/// </summary>
public interface IToolbox
{
    string Id { get; }

    /// <summary>Shown to people in the assistant editor and the admin panel.</summary>
    string DisplayName { get; }

    /// <summary>Shown to people. For a top-level toolbox also written for the model: what the toolbox covers.</summary>
    string Description { get; }

    /// <summary>Who may use the toolbox when no override is stored.</summary>
    ToolAccessPolicy DefaultPolicy { get; }

    IReadOnlyList<ITool> Tools { get; }

    IReadOnlyList<IToolbox> Children { get; }

    /// <summary>The lowest classification of the toolbox's own tools. Children are not included.</summary>
    DataClassification Classification => Tools.Count == 0 ? DataClassification.Red : Tools.Min(t => t.Classification);
}

public sealed class Toolbox : IToolbox
{
    public required string Id { get; init; }

    public required string DisplayName { get; init; }

    public required string Description { get; init; }

    public ToolAccessPolicy DefaultPolicy { get; init; } = ToolAccessPolicy.Everyone;

    public required IReadOnlyList<ITool> Tools { get; init; }

    public IReadOnlyList<IToolbox> Children { get; init; } = [];

    /// <summary>A toolbox holding one tool, under the tool's own id, name, description and policy.</summary>
    public static Toolbox Of(ITool tool) => new()
    {
        Id = tool.Id,
        DisplayName = tool.DisplayName,
        Description = tool.Description,
        DefaultPolicy = tool.DefaultPolicy,
        Tools = [tool]
    };
}

/// <summary>A selected top-level toolbox with the tools of its selected children added.</summary>
public sealed record ResolvedToolbox(IToolbox Toolbox, IReadOnlyList<ITool> Tools);
