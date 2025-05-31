using System.Text.Json.Serialization;

namespace ChatUitReact.Server.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum UserRole
{
    User,
    Admin,
    Beta,
    Super,
    External
}
