using System.Text.Json;
using System.Text.Json.Serialization;

namespace ChatUitReact.Server.Models;

/// <summary>
/// Serialises enum members in camelCase. The chunk and activity enums that predate the tool
/// system are PascalCase on the wire; the tool enums are camelCase so the client can use the
/// same string as a CSS state and a translation key.
/// </summary>
public sealed class CamelCaseEnumConverter : JsonStringEnumConverter
{
    public CamelCaseEnumConverter() : base(JsonNamingPolicy.CamelCase)
    {
    }
}

/// <summary>Where a tool's code runs.</summary>
[JsonConverter(typeof(CamelCaseEnumConverter))]
public enum ToolExecution
{
    Server,
    Client
}

/// <summary>
/// The lifecycle of one tool call. Persisted history only holds the terminal states
/// (Completed, Rejected, Timeout, Error); the awaiting states exist on the live stream.
/// </summary>
[JsonConverter(typeof(CamelCaseEnumConverter))]
public enum ToolCallStatus
{
    Running,
    AwaitingConfirmation,
    AwaitingClient,
    Approved,
    Completed,
    Rejected,
    Timeout,
    Error
}

/// <summary>What a respond call answers.</summary>
[JsonConverter(typeof(CamelCaseEnumConverter))]
public enum ToolCallResponseKind
{
    Confirmation,
    ClientResult
}

[JsonConverter(typeof(CamelCaseEnumConverter))]
public enum ToolCallDecision
{
    Approve,
    Reject
}

public static class ToolCallStatusExtensions
{
    public static bool IsTerminal(this ToolCallStatus status) => status is
        ToolCallStatus.Completed or ToolCallStatus.Rejected or ToolCallStatus.Timeout or ToolCallStatus.Error;
}
