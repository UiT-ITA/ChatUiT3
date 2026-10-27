using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using ChatUiT.Server.Services.Tools;
using Microsoft.Extensions.Logging;

namespace ChatUiT.Server.Services.Agents;

/// <summary>Every internal agent definition, whether or not a tool calls it.</summary>
public interface IInternalAgentRegistry
{
    IReadOnlyList<InternalAgent> Agents { get; }

    InternalAgent? Find(string id);
}

/// <summary>
/// Validated when it is built (at startup, see Program.cs): each id follows the tool id rule and
/// is unique, and each agent's function ids are unique within it.
/// </summary>
public sealed partial class InternalAgentRegistry : IInternalAgentRegistry
{
    [GeneratedRegex("^[a-z][a-z0-9_]{0,63}$")]
    private static partial Regex IdPattern();

    private readonly Dictionary<string, InternalAgent> _byId = new(StringComparer.Ordinal);

    public InternalAgentRegistry(IEnumerable<InternalAgent> agents, ILogger<InternalAgentRegistry> logger)
    {
        foreach (var agent in agents)
        {
            if (!IdPattern().IsMatch(agent.Id) || agent.Id.StartsWith(ClientTool.Prefix, StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    $"Internal agent id '{agent.Id}' ({agent.GetType().Name}) must match ^[a-z][a-z0-9_]{{0,63}}$ and not start with '{ClientTool.Prefix}'.");
            }

            if (!_byId.TryAdd(agent.Id, agent))
            {
                throw new InvalidOperationException($"Internal agent id '{agent.Id}' is registered twice.");
            }

            if (agent.Functions.GroupBy(f => f.Id, StringComparer.Ordinal).FirstOrDefault(g => g.Count() > 1) is { } duplicate)
            {
                throw new InvalidOperationException($"Internal agent '{agent.Id}' has two functions with id '{duplicate.Key}'.");
            }
        }

        Agents = _byId.Values.OrderBy(a => a.Id, StringComparer.Ordinal).ToList();
        logger.LogInformation("Registered {Count} internal agents: {Ids}", Agents.Count, string.Join(", ", Agents.Select(a => a.Id)));
    }

    public IReadOnlyList<InternalAgent> Agents { get; }

    public InternalAgent? Find(string id) => _byId.TryGetValue(id, out var agent) ? agent : null;
}
