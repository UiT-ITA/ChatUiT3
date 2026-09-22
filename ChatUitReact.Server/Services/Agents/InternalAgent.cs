using System.Collections.Generic;
using System.Linq;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents;

/// <summary>
/// A code-defined agent: its own system prompt and a private set of functions, run as a nested
/// model loop. Assistants see it as one tool with a single <c>task</c> argument, so the outer
/// conversation carries neither the function schemas nor the intermediate payloads.
///
/// Internal agents are never stored and have no editor. They are unrelated to system assistants,
/// which are ordinary assistant documents. Add one by subclassing this, registering it with
/// <see cref="InternalAgentServiceCollectionExtensions.AddInternalAgent{TAgent}"/>, and nothing else.
/// </summary>
public abstract class InternalAgent
{
    /// <summary>Same rules as a tool id: <c>^[a-z][a-z0-9_]{0,63}$</c>, never <c>client_*</c>.</summary>
    public abstract string Id { get; }

    public abstract string DisplayName { get; }

    /// <summary>Shown to the outer model as the tool description. Say which tasks to delegate and what to include in them.</summary>
    public abstract string Description { get; }

    /// <summary>The inner system prompt.</summary>
    public abstract string SystemPrompt { get; }

    /// <summary>Private functions. They are not in the tool registry and have no policies of their own.</summary>
    public abstract IReadOnlyList<ITool> Functions { get; }

    /// <summary>Who may use the agent when no override is stored. Applies to the agent as a whole.</summary>
    public virtual ToolAccessPolicy DefaultPolicy => ToolAccessPolicy.Everyone;

    /// <summary>How many rounds of function calls the inner loop may take before it is told to answer.</summary>
    public virtual int MaxRounds => 12;

    public IReadOnlyList<string> RequiredScopes => Functions.SelectMany(f => f.RequiredScopes).Distinct().ToList();
}
