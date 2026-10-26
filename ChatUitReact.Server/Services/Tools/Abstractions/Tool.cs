using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services.Tools;

/// <summary>
/// Base for tools with typed arguments. The schema is generated once from
/// <typeparamref name="TArgs"/>; annotate its members with
/// <see cref="System.ComponentModel.DescriptionAttribute"/> for the model.
/// </summary>
public abstract class Tool<TArgs> : ITool where TArgs : class
{
    private JsonObject? _schema;

    public abstract string Id { get; }

    public abstract string DisplayName { get; }

    public abstract string Description { get; }

    public abstract DataClassification Classification { get; }

    public virtual ToolAccessPolicy DefaultPolicy => ToolAccessPolicy.Everyone;

    public virtual IReadOnlyList<string> LegacyIds => [];

    public virtual IReadOnlyList<string> RequiredScopes => [];

    public JsonObject ParametersSchema => _schema ??= ToolSchema.For<TArgs>();

    public Task<ToolResult> ExecuteAsync(ToolInvocation invocation, CancellationToken cancellationToken)
    {
        var args = ToolSchema.Deserialize<TArgs>(invocation.Arguments);
        return ExecuteAsync(args, invocation, cancellationToken);
    }

    protected abstract Task<ToolResult> ExecuteAsync(TArgs args, ToolInvocation invocation, CancellationToken cancellationToken);
}

/// <summary>Typed-argument base for confirmable tools.</summary>
public abstract class ConfirmableTool<TArgs> : Tool<TArgs>, IConfirmableTool where TArgs : class
{
    public Task<ToolPreview> PrepareAsync(ToolInvocation invocation, CancellationToken cancellationToken)
        => PrepareAsync(ToolSchema.Deserialize<TArgs>(invocation.Arguments), invocation, cancellationToken);

    public Task<ToolResult> CommitAsync(ToolInvocation invocation, JsonElement approvedArguments, CancellationToken cancellationToken)
        => CommitAsync(ToolSchema.Deserialize<TArgs>(approvedArguments), invocation, cancellationToken);

    protected abstract Task<ToolPreview> PrepareAsync(TArgs args, ToolInvocation invocation, CancellationToken cancellationToken);

    protected abstract Task<ToolResult> CommitAsync(TArgs args, ToolInvocation invocation, CancellationToken cancellationToken);

    /// <summary>Never reached: the executor routes confirmable tools through Prepare and Commit.</summary>
    protected override Task<ToolResult> ExecuteAsync(TArgs args, ToolInvocation invocation, CancellationToken cancellationToken)
        => throw new InvalidOperationException($"{Id} requires confirmation and cannot be executed directly.");
}
