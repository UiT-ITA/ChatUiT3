using System.Text.Json.Serialization;

namespace ChatUiT.Server.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum AiChatRole
{
    User,
    Assistant,
    System,
    ToolRequest,
    ToolResponse,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum AiContentType
{
    Text,
    Image,
    Mixed
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum AiChatStatus
{
    New,
    Generating,
    Success,
    Error,
    Cancelled,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum NotifyLevel
{
    Info,
    Success,
    Warning,
    Error
}
