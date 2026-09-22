using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services.Tools;

/// <summary>
/// One tool the model can call. Provider neutral: adapters read <see cref="Id"/>,
/// <see cref="Description"/> and <see cref="ParametersSchema"/> and nothing else.
///
/// <see cref="Id"/> is also the function name the model sees, so there is one identifier
/// to keep stable. Server tool ids match <c>^[a-z][a-z0-9_]{0,63}$</c> and never start with
/// <c>client_</c>; the registry rejects violations at startup.
/// </summary>
public interface ITool
{
    string Id { get; }

    /// <summary>Shown to people in the assistant editor and the activity panel.</summary>
    string DisplayName { get; }

    /// <summary>Written for the model.</summary>
    string Description { get; }

    /// <summary>JSON Schema for the arguments. Always an object schema.</summary>
    JsonObject ParametersSchema { get; }

    /// <summary>Ids this tool was stored under before, so existing assistants keep working.</summary>
    IReadOnlyList<string> LegacyIds => [];

    /// <summary>Who may use the tool when no override is stored.</summary>
    ToolAccessPolicy DefaultPolicy { get; }

    /// <summary>Delegated scopes the tool acquires through <see cref="IUserTokenProvider"/>.</summary>
    IReadOnlyList<string> RequiredScopes => [];

    ToolExecution Execution => ToolExecution.Server;

    Task<ToolResult> ExecuteAsync(ToolInvocation invocation, CancellationToken cancellationToken);
}

/// <summary>
/// A tool with side effects the user must approve first. The executor calls
/// <see cref="PrepareAsync"/>, shows the preview, waits, and only then calls
/// <see cref="CommitAsync"/>. <see cref="ITool.ExecuteAsync"/> is never called.
/// </summary>
public interface IConfirmableTool : ITool
{
    /// <summary>Validates the arguments and builds the preview. Must have no side effects.</summary>
    Task<ToolPreview> PrepareAsync(ToolInvocation invocation, CancellationToken cancellationToken);

    /// <param name="approvedArguments">The arguments the user approved, edited when the preview allowed it.</param>
    Task<ToolResult> CommitAsync(ToolInvocation invocation, JsonElement approvedArguments, CancellationToken cancellationToken);
}

/// <summary>What the user sees before approving a confirmable tool.</summary>
public sealed record ToolPreview(
    string Title,
    string? Summary,
    IReadOnlyList<ToolPreviewField> Fields,
    bool AllowEdit = true);

public sealed record ToolPreviewField(string Label, string Value, bool Multiline = false);

public sealed record ToolInvocation(string ToolCallId, JsonElement Arguments, ToolExecutionContext Context);

/// <summary>Everything a tool may know about the run it executes in.</summary>
public sealed class ToolExecutionContext
{
    public required string UserId { get; init; }

    public required string ChatId { get; init; }

    public required string MessageId { get; init; }

    public required UserAccess Access { get; init; }

    public required IUserTokenProvider Tokens { get; init; }
}

/// <summary>
/// What a tool returns. <see cref="Content"/> goes to the model; <see cref="Display"/> is
/// what the user sees in the activity panel and defaults to the content.
/// </summary>
public sealed record ToolResult(string Content, string? Display = null, bool IsError = false)
{
    public string DisplayText => Display ?? Content;

    public static ToolResult Ok(object payload, string? display = null)
        => new(JsonSerializer.Serialize(payload, ToolJson.Options), display);

    public static ToolResult Text(string content, string? display = null) => new(content, display);

    public static ToolResult Error(string message) => new(message, message, IsError: true);
}

public static class ToolJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
}
