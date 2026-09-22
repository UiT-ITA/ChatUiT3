using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents;

public sealed record InternalAgentTaskArgs(
    [property: Description("The whole task in natural language, with every name, date, time and detail the agent needs, and what form the answer should take. The agent has no access to the conversation.")]
    string Task);

/// <summary>Exposes an <see cref="InternalAgent"/> to assistants as one streaming tool.</summary>
public sealed class InternalAgentTool : IStreamingTool
{
    private static readonly JsonObject Schema = ToolSchema.For<InternalAgentTaskArgs>();

    private readonly InternalAgentRunner _runner;

    public InternalAgentTool(InternalAgent agent, InternalAgentRunner runner)
    {
        Agent = agent;
        _runner = runner;
    }

    public InternalAgent Agent { get; }

    public string Id => Agent.Id;

    public string DisplayName => Agent.DisplayName;

    public string Description => Agent.Description;

    public JsonObject ParametersSchema => Schema;

    public ToolAccessPolicy DefaultPolicy => Agent.DefaultPolicy;

    public IReadOnlyList<string> RequiredScopes => Agent.RequiredScopes;

    public Task<ToolResult> ExecuteAsync(ToolInvocation invocation, CancellationToken cancellationToken)
        => throw new System.InvalidOperationException("Streaming tools run through StreamAsync.");

    public async IAsyncEnumerable<ToolExecutionEvent> StreamAsync(ToolInvocation invocation, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        InternalAgentTaskArgs? args = null;
        string? argumentError = null;
        try
        {
            args = ToolSchema.Deserialize<InternalAgentTaskArgs>(invocation.Arguments);
        }
        catch (ToolArgumentException ex)
        {
            argumentError = ex.Message;
        }

        if (args == null)
        {
            yield return new ToolExecutionEvent.Completed(ToolResult.Error(argumentError ?? "Invalid arguments."), ToolCallStatus.Error);
            yield break;
        }

        await foreach (var evt in _runner.RunAsync(Agent, args.Task, invocation.Context, invocation.ToolCallId, cancellationToken))
        {
            yield return evt;
        }
    }
}
