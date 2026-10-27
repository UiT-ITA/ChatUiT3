using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;

namespace ChatUiT.Server.Services.Tools;

/// <summary>
/// Which toolboxes exist. Top-level toolboxes come from DI, their children from
/// <see cref="IToolbox.Children"/>; all are validated at startup.
/// </summary>
public interface IToolboxRegistry
{
    /// <summary>The top-level toolboxes, sorted by display name.</summary>
    IReadOnlyList<IToolbox> Toolboxes { get; }

    /// <summary>Every toolbox, each top-level toolbox followed by its descendants.</summary>
    IReadOnlyList<IToolbox> All { get; }

    /// <summary>Finds a toolbox, top-level or child, by id.</summary>
    IToolbox? Find(string id);

    /// <summary>The toolbox that holds this one as a child. Null for a top-level toolbox or an unknown id.</summary>
    IToolbox? ParentOf(string id);

    /// <summary>The selected ids that are no toolbox, or a child whose parent is not selected.</summary>
    IReadOnlyList<string> Invalid(IEnumerable<string> selectedIds);

    /// <summary>
    /// The selected top-level toolboxes in selection order, each with its own tools followed by
    /// the tools of its selected children. Unknown ids and children whose parent is not selected
    /// are skipped.
    /// </summary>
    IReadOnlyList<ResolvedToolbox> Resolve(IEnumerable<string> selectedIds);

    /// <summary>The toolboxes, top-level or child, that contain the tool with this id.</summary>
    IReadOnlyList<IToolbox> Containing(string toolId);
}

public sealed partial class ToolboxRegistry : IToolboxRegistry
{
    [GeneratedRegex("^[a-z][a-z0-9_]{0,63}$")]
    private static partial Regex IdPattern();

    private readonly Dictionary<string, IToolbox> _byId = new(StringComparer.Ordinal);
    private readonly Dictionary<string, IToolbox> _parents = new(StringComparer.Ordinal);
    private readonly Dictionary<string, List<IToolbox>> _byToolId = new(StringComparer.Ordinal);
    private readonly Dictionary<string, ITool> _toolsById = new(StringComparer.Ordinal);

    public ToolboxRegistry(IEnumerable<IToolbox> toolboxes, ILogger<ToolboxRegistry> logger)
    {
        Toolboxes = toolboxes.OrderBy(t => t.DisplayName, StringComparer.OrdinalIgnoreCase).ToList();

        var all = new List<IToolbox>();
        foreach (var toolbox in Toolboxes)
        {
            Register(toolbox, parent: null, all);
        }

        All = all;
        logger.LogInformation("Registered {Count} toolboxes: {Ids}", All.Count, string.Join(", ", All.Select(t => t.Id)));
    }

    private void Register(IToolbox toolbox, IToolbox? parent, List<IToolbox> all)
    {
        if (!IdPattern().IsMatch(toolbox.Id) || toolbox.Id.StartsWith(ClientTool.Prefix, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                $"Toolbox id '{toolbox.Id}' must match ^[a-z][a-z0-9_]{{0,63}}$ and not start with '{ClientTool.Prefix}'.");
        }

        if (toolbox.Id == ToolRegistry.ClientToolsPolicyId || !_byId.TryAdd(toolbox.Id, toolbox))
        {
            throw new InvalidOperationException($"Toolbox id '{toolbox.Id}' is registered twice or is reserved.");
        }

        if (toolbox.Tools.Count == 0)
        {
            throw new InvalidOperationException($"Toolbox '{toolbox.Id}' has no tools.");
        }

        if (parent != null)
        {
            _parents[toolbox.Id] = parent;
        }

        foreach (var tool in toolbox.Tools)
        {
            // One id is one tool across all toolboxes.
            if (_toolsById.TryGetValue(tool.Id, out var known) && !ReferenceEquals(known, tool))
            {
                throw new InvalidOperationException($"Tool id '{tool.Id}' in toolbox '{toolbox.Id}' is a different tool from the one other toolboxes hold.");
            }

            _toolsById[tool.Id] = tool;

            if (!_byToolId.TryGetValue(tool.Id, out var holders))
            {
                _byToolId[tool.Id] = holders = new List<IToolbox>();
            }

            if (holders.Contains(toolbox))
            {
                throw new InvalidOperationException($"Toolbox '{toolbox.Id}' holds tool '{tool.Id}' twice.");
            }

            holders.Add(toolbox);
        }

        all.Add(toolbox);
        foreach (var child in toolbox.Children)
        {
            Register(child, toolbox, all);
        }
    }

    public IReadOnlyList<IToolbox> Toolboxes { get; }

    public IReadOnlyList<IToolbox> All { get; }

    public IToolbox? Find(string id) => id != null && _byId.TryGetValue(id, out var toolbox) ? toolbox : null;

    public IToolbox? ParentOf(string id) => id != null && _parents.TryGetValue(id, out var parent) ? parent : null;

    public IReadOnlyList<string> Invalid(IEnumerable<string> selectedIds)
    {
        var selected = (selectedIds ?? []).ToHashSet(StringComparer.Ordinal);
        return selected
            .Where(id => Find(id) == null || ParentOf(id) is { } parent && !selected.Contains(parent.Id))
            .ToList();
    }

    public IReadOnlyList<ResolvedToolbox> Resolve(IEnumerable<string> selectedIds)
    {
        var ids = (selectedIds ?? []).Distinct(StringComparer.Ordinal).ToList();
        var selected = ids.ToHashSet(StringComparer.Ordinal);

        return ids
            .Select(Find)
            .OfType<IToolbox>()
            .Where(toolbox => !_parents.ContainsKey(toolbox.Id))
            .Select(toolbox => new ResolvedToolbox(toolbox, ToolsOf(toolbox, selected)))
            .ToList();
    }

    private static IReadOnlyList<ITool> ToolsOf(IToolbox toolbox, HashSet<string> selected)
        => toolbox.Tools
            .Concat(toolbox.Children.Where(child => selected.Contains(child.Id)).SelectMany(child => ToolsOf(child, selected)))
            .DistinctBy(tool => tool.Id)
            .ToList();

    public IReadOnlyList<IToolbox> Containing(string toolId)
        => toolId != null && _byToolId.TryGetValue(toolId, out var holders) ? holders : [];
}
