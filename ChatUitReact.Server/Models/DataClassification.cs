using System.Text.Json.Serialization;

namespace ChatUitReact.Server.Models;

/// <summary>
/// Which data may be put into a model, function, toolbox, assistant or chat. Ordered from lowest
/// to highest, so the classification of a whole is the minimum of its parts.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum DataClassification
{
    Green,
    Yellow,
    Red
}
