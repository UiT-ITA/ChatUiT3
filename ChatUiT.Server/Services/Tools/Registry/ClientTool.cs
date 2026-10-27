using System;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;

namespace ChatUiT.Server.Services.Tools;

/// <summary>
/// A tool the calling client runs itself. The server only relays the call and waits for the
/// result; <see cref="ExecuteAsync"/> is never reached because the executor routes on
/// <see cref="Execution"/>.
/// </summary>
public sealed class ClientTool : ITool
{
    public const string Prefix = "client_";

    /// <summary>The classification of every client tool.</summary>
    public const DataClassification ClientClassification = DataClassification.Red;

    public ClientTool(string id, string description, JsonObject parametersSchema)
    {
        Id = id;
        Description = description;
        ParametersSchema = parametersSchema;
    }

    public string Id { get; }

    public string DisplayName => Id;

    public string Description { get; }

    public DataClassification Classification => ClientClassification;

    public JsonObject ParametersSchema { get; }

    /// <summary>Client tools are gated as a group by the <c>client_tools</c> policy, not one by one.</summary>
    public ToolAccessPolicy DefaultPolicy => ToolAccessPolicy.Everyone;

    public ToolExecution Execution => ToolExecution.Client;

    public Task<ToolResult> ExecuteAsync(ToolInvocation invocation, CancellationToken cancellationToken)
        => throw new InvalidOperationException($"{Id} runs on the client.");
}
