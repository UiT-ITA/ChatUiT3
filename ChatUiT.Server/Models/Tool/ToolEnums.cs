using System.Text.Json;
using System.Text.Json.Serialization;

namespace ChatUiT.Server.Models;

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
/// The lifecycle of one tool call. A call that needs the user ends the run in an awaiting state
/// and stays there, stored on the message, until the user answers; the run that continues the
/// message moves it on. Unanswered marks a call the user left behind by sending a new message.
/// Timeout only appears in history written before calls stopped waiting in process.
/// </summary>
[JsonConverter(typeof(CamelCaseEnumConverter))]
public enum ToolCallStatus
{
    Running,
    AwaitingConfirmation,
    AwaitingAnswer,
    AwaitingClient,
    Approved,
    Completed,
    Rejected,
    Unanswered,
    Timeout,
    Error
}

/// <summary>What a respond call answers.</summary>
[JsonConverter(typeof(CamelCaseEnumConverter))]
public enum ToolCallResponseKind
{
    Confirmation,
    Answer,
    ClientResult
}

[JsonConverter(typeof(CamelCaseEnumConverter))]
public enum ToolCallDecision
{
    Approve,
    Reject
}

/// <summary>
/// What kind of action a confirmation preview shows. The tool says what it is about to do; the
/// client owns how each kind is laid out and shows <see cref="General"/> as a list of fields.
/// </summary>
[JsonConverter(typeof(CamelCaseEnumConverter))]
public enum ToolPreviewKind
{
    General,
    Message,
    File,
    DocumentEdit,
    Event
}

/// <summary>What a preview field holds, so the layout of a kind can place it. Fields without a role are listed by label.</summary>
[JsonConverter(typeof(CamelCaseEnumConverter))]
public enum ToolPreviewFieldRole
{
    None,
    Recipients,
    Subject,
    Body,
    Attachments,
    Path,
    Content,
    Document,
    Changes,
    Time,
    Location,
    Attendees
}

public static class ToolCallStatusExtensions
{
    public static bool IsTerminal(this ToolCallStatus status) => status is
        ToolCallStatus.Completed or ToolCallStatus.Rejected or ToolCallStatus.Unanswered or ToolCallStatus.Timeout or ToolCallStatus.Error;

    /// <summary>The call waits for the user or the client before it can go on.</summary>
    public static bool IsAwaiting(this ToolCallStatus status) => status is
        ToolCallStatus.AwaitingConfirmation or ToolCallStatus.AwaitingAnswer or ToolCallStatus.AwaitingClient;
}
