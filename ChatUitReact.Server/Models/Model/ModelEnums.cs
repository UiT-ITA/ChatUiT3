using System.Text.Json.Serialization;

namespace ChatUitReact.Server.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ReasoningEffort
{
    None,
    Low,
    Medium,
    High
}
