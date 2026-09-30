using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;
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

    private const string ClientIdRule = "^client_[a-z0-9_]{1,50}$";

    /// <summary>The Responses API's own function name rule; clashes with server tools are checked per request.</summary>
    private const string ResponsesFunctionNameRule = "^[a-zA-Z0-9_-]{1,64}$";

    [GeneratedRegex(ClientIdRule)]
    private static partial Regex ClientIdPattern();

    [GeneratedRegex(ResponsesFunctionNameRule)]
    private static partial Regex ResponsesFunctionNamePattern();

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
        => CreateClientTools(
            (declarations ?? []).Select(d => new ClientToolDeclaration(d.Name?.Trim() ?? string.Empty, d.Description, d.ParametersSchema)).ToList(),
            ClientIdPattern(), ClientIdRule, descriptionRequired: true, reservedNames: []);

    public IReadOnlyList<ITool> CreateResponsesClientTools(IReadOnlyList<ClientToolDeclaration> declarations, IReadOnlyCollection<string> serverToolIds)
        => CreateClientTools(declarations, ResponsesFunctionNamePattern(), ResponsesFunctionNameRule, descriptionRequired: false, serverToolIds);

    private IReadOnlyList<ITool> CreateClientTools(
        IReadOnlyList<ClientToolDeclaration> declarations,
        Regex namePattern,
        string nameRule,
        bool descriptionRequired,
        IReadOnlyCollection<string> reservedNames)
    {
        if (declarations.Count > _options.MaxClientTools)
        {
            throw new ClientToolDeclarationException(null, "tools", $"At most {_options.MaxClientTools} client tools may be declared.");
        }

        var result = new List<ITool>(declarations.Count);
        var names = new HashSet<string>(StringComparer.Ordinal);

        for (var i = 0; i < declarations.Count; i++)
        {
            var declaration = declarations[i];
            var name = declaration.Name;
            if (!namePattern.IsMatch(name))
            {
                throw new ClientToolDeclarationException(i, "name", $"Client tool name '{name}' must match {nameRule}.");
            }

            if (reservedNames.Contains(name))
            {
                throw new ClientToolDeclarationException(i, "name", $"'{name}' is the name of one of this model's server tools.");
            }

            if (!names.Add(name))
            {
                throw new ClientToolDeclarationException(i, "name", $"Client tool '{name}' is declared twice.");
            }

            if (descriptionRequired && string.IsNullOrWhiteSpace(declaration.Description))
            {
                throw new ClientToolDeclarationException(i, "description", $"Client tool '{name}' needs a description.");
            }

            JsonObject schema;
            try
            {
                schema = declaration.ParametersSchema is { } parameters
                    ? ToolSchema.ValidateClientSchema(parameters, _options)
                    : ToolSchema.Empty();
            }
            catch (ToolArgumentException ex)
            {
                throw new ClientToolDeclarationException(i, "parameters", ex.Message);
            }

            result.Add(new ClientTool(name, declaration.Description?.Trim() ?? string.Empty, schema));
        }

        return result;
    }
}
