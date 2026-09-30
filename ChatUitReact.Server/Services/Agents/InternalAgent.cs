using System.Collections.Generic;
using System.Linq;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents;

/// <summary>
/// A code-defined agent: its own system prompt and a private set of functions. It is a
/// definition only. It runs as a nested model loop when its tool calls it
/// (<see cref="InternalAgentTool"/>, opt-in through
/// <see cref="InternalAgentServiceCollectionExtensions.AddInternalAgentTool{TAgent}"/>), and as
/// the top-level conversation when the Responses API exposes it. Both runs are set up by
/// <see cref="InternalAgentRunner.SetupAsync"/>; the model it runs on is an admin setting.
///
/// Internal agents are unrelated to system assistants, which are ordinary assistant documents.
/// Add one by subclassing this and registering it with
/// <see cref="InternalAgentServiceCollectionExtensions.AddInternalAgent{TAgent}"/>.
/// </summary>
public abstract class InternalAgent
{
    /// <summary>Same rules as a tool id: <c>^[a-z][a-z0-9_]{0,63}$</c>, never <c>client_*</c>.</summary>
    public abstract string Id { get; }

    public abstract string DisplayName { get; }

    /// <summary>Shown to the outer model as the tool description. Say which tasks to delegate and what to include in them.</summary>
    public abstract string Description { get; }

    public abstract string SystemPrompt { get; }

    /// <summary>Private functions. They are not in the tool registry and have no policies of their own.</summary>
    public abstract IReadOnlyList<ITool> Functions { get; }

    /// <summary>
    /// Who may use the agent. Its tool's policy when no override is stored, and in the Responses
    /// API a gate on top of the catalog entry's policy.
    /// </summary>
    public virtual ToolAccessPolicy DefaultPolicy => ToolAccessPolicy.Everyone;

    /// <summary>
    /// How many rounds of function calls a run may take before the calls get "budget exhausted"
    /// results and the model must answer. The Responses API counts rounds across requests.
    /// </summary>
    public virtual int MaxRounds => 12;

    public IReadOnlyList<string> RequiredScopes => Functions.SelectMany(f => f.RequiredScopes).Distinct().ToList();
}
