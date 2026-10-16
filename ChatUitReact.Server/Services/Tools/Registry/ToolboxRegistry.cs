using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;

namespace ChatUitReact.Server.Services.Tools;

/// <summary>Which toolboxes exist. Toolboxes come from DI and are validated at startup.</summary>
public interface IToolboxRegistry
{
    IReadOnlyList<IToolbox> Toolboxes { get; }

    /// <summary>Finds a toolbox by its current id.</summary>
    IToolbox? Find(string id);

    /// <summary>
    /// Maps a stored id to current toolbox ids: a current id to itself, a legacy id to every
    /// toolbox that claims it. Unknown ids pass through unchanged.
    /// </summary>
    IReadOnlyList<string> Expand(string idOrLegacyId);

    /// <summary>Resolves stored ids to toolboxes, expanding legacy ids and skipping unknown ones.</summary>
    IReadOnlyList<IToolbox> Resolve(IEnumerable<string> idsOrLegacyIds);

    /// <summary>The toolboxes that contain the tool with this id.</summary>
    IReadOnlyList<IToolbox> Containing(string toolId);
}

public sealed partial class ToolboxRegistry : IToolboxRegistry
{
    [GeneratedRegex("^[a-z][a-z0-9_]{0,63}$")]
    private static partial Regex IdPattern();

    private readonly Dictionary<string, IToolbox> _byId = new(StringComparer.Ordinal);
    private readonly Dictionary<string, List<string>> _byLegacyId = new(StringComparer.Ordinal);
    private readonly Dictionary<string, List<IToolbox>> _byToolId = new(StringComparer.Ordinal);

    public ToolboxRegistry(IEnumerable<IToolbox> toolboxes, ILogger<ToolboxRegistry> logger)
    {
        var toolsById = new Dictionary<string, ITool>(StringComparer.Ordinal);

        foreach (var toolbox in toolboxes)
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

            foreach (var tool in toolbox.Tools)
            {
                // One id is one tool across all toolboxes.
                if (toolsById.TryGetValue(tool.Id, out var known) && !ReferenceEquals(known, tool))
                {
                    throw new InvalidOperationException($"Tool id '{tool.Id}' in toolbox '{toolbox.Id}' is a different tool from the one other toolboxes hold.");
                }

                toolsById[tool.Id] = tool;

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

            foreach (var legacy in toolbox.LegacyIds)
            {
                if (!_byLegacyId.TryGetValue(legacy, out var ids))
                {
                    _byLegacyId[legacy] = ids = new List<string>();
                }

                ids.Add(toolbox.Id);
            }
        }

        if (_byLegacyId.Keys.FirstOrDefault(_byId.ContainsKey) is { } clash)
        {
            throw new InvalidOperationException($"Legacy id '{clash}' is also the id of a toolbox.");
        }

        Toolboxes = _byId.Values.OrderBy(t => t.DisplayName, StringComparer.OrdinalIgnoreCase).ToList();
        logger.LogInformation("Registered {Count} toolboxes: {Ids}", Toolboxes.Count, string.Join(", ", Toolboxes.Select(t => t.Id)));
    }

    public IReadOnlyList<IToolbox> Toolboxes { get; }

    public IToolbox? Find(string id) => id != null && _byId.TryGetValue(id, out var toolbox) ? toolbox : null;

    public IReadOnlyList<string> Expand(string idOrLegacyId)
    {
        if (idOrLegacyId == null)
        {
            return [];
        }

        return _byLegacyId.TryGetValue(idOrLegacyId, out var ids) ? ids : [idOrLegacyId];
    }

    public IReadOnlyList<IToolbox> Resolve(IEnumerable<string> idsOrLegacyIds)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var result = new List<IToolbox>();
        foreach (var id in (idsOrLegacyIds ?? []).SelectMany(Expand))
        {
            if (Find(id) is { } toolbox && seen.Add(toolbox.Id))
            {
                result.Add(toolbox);
            }
        }

        return result;
    }

    public IReadOnlyList<IToolbox> Containing(string toolId)
        => toolId != null && _byToolId.TryGetValue(toolId, out var holders) ? holders : [];
}
