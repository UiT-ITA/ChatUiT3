using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using ChatUitReact.Server.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace ChatUitReact.Server.Services.Tools;

public sealed partial class ToolRegistry : IToolRegistry
{
    /// <summary>The pseudo tool id whose policy decides whether a caller may attach client tools at all.</summary>
    public const string ClientToolsPolicyId = "client_tools";

    [GeneratedRegex("^[a-z][a-z0-9_]{0,63}$")]
    private static partial Regex ServerIdPattern();

    [GeneratedRegex("^client_[a-z0-9_]{1,50}$")]
    private static partial Regex ClientIdPattern();

    private readonly Dictionary<string, ITool> _byId;
    private readonly Dictionary<string, ITool> _byAnyId;
    private readonly ToolOptions _options;

    public ToolRegistry(IEnumerable<ITool> tools, IOptions<ToolOptions> options, ILogger<ToolRegistry> logger)
    {
        _options = options.Value;
        _byId = new Dictionary<string, ITool>(StringComparer.Ordinal);
        _byAnyId = new Dictionary<string, ITool>(StringComparer.Ordinal);

        foreach (var tool in tools)
        {
            if (!ServerIdPattern().IsMatch(tool.Id) || tool.Id.StartsWith(ClientTool.Prefix, StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    $"Tool id '{tool.Id}' ({tool.GetType().Name}) must match ^[a-z][a-z0-9_]{{0,63}}$ and not start with '{ClientTool.Prefix}'.");
            }

            if (!_byId.TryAdd(tool.Id, tool))
            {
                throw new InvalidOperationException($"Tool id '{tool.Id}' is registered twice.");
            }

            _byAnyId[tool.Id] = tool;
            foreach (var legacy in tool.LegacyIds)
            {
                if (!_byAnyId.TryAdd(legacy, tool))
                {
                    throw new InvalidOperationException($"Legacy tool id '{legacy}' is claimed by more than one tool.");
                }
            }
        }

        ServerTools = _byId.Values.OrderBy(t => t.DisplayName, StringComparer.OrdinalIgnoreCase).ToList();
        logger.LogInformation("Registered {Count} server tools: {Ids}", ServerTools.Count, string.Join(", ", ServerTools.Select(t => t.Id)));
    }

    public IReadOnlyList<ITool> ServerTools { get; }

    public ITool? Find(string idOrLegacyId)
        => idOrLegacyId != null && _byAnyId.TryGetValue(idOrLegacyId, out var tool) ? tool : null;

    public string Normalise(string idOrLegacyId) => Find(idOrLegacyId)?.Id ?? idOrLegacyId;

    public IReadOnlyList<ITool> Resolve(IEnumerable<string> idsOrLegacyIds)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var result = new List<ITool>();
        foreach (var id in idsOrLegacyIds ?? [])
        {
            var tool = Find(id);
            if (tool != null && seen.Add(tool.Id))
            {
                result.Add(tool);
            }
        }

        return result;
    }

    public IReadOnlyList<ITool> CreateClientTools(IEnumerable<ClientToolDeclarationDto> declarations)
    {
        var list = declarations?.ToList() ?? [];
        if (list.Count > _options.MaxClientTools)
        {
            throw new ToolArgumentException($"At most {_options.MaxClientTools} client tools may be declared.");
        }

        var result = new List<ITool>(list.Count);
        var names = new HashSet<string>(StringComparer.Ordinal);

        foreach (var declaration in list)
        {
            var name = declaration.Name?.Trim() ?? string.Empty;
            if (!ClientIdPattern().IsMatch(name))
            {
                throw new ToolArgumentException($"Client tool name '{name}' must match ^client_[a-z0-9_]{{1,50}}$.");
            }

            if (!names.Add(name))
            {
                throw new ToolArgumentException($"Client tool '{name}' is declared twice.");
            }

            if (string.IsNullOrWhiteSpace(declaration.Description))
            {
                throw new ToolArgumentException($"Client tool '{name}' needs a description.");
            }

            var schema = ToolSchema.ValidateClientSchema(declaration.ParametersSchema, _options);
            result.Add(new ClientTool(name, declaration.Description.Trim(), schema));
        }

        return result;
    }
}
