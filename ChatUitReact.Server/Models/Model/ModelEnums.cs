using System.Text.Json.Serialization;

namespace ChatUitReact.Server.Models;

/// <summary>
/// How much reasoning a model should spend on a request.
/// The ladder is per-model — see <see cref="ModelCapabilities.SupportedEfforts"/>.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ReasoningEffort
{
    None,
    Low,
    Medium,
    High,
    XHigh,
    Max
}

/// <summary>
/// Whether a model accepts a <c>temperature</c> parameter.
/// A boolean cannot express the gpt-5.x rule, where temperature is accepted only
/// while reasoning is switched off — sending it alongside an active reasoning
/// effort returns HTTP 400.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TemperatureSupport
{
    /// <summary>Never send temperature (Claude Opus 5 / 4.8 return 400 for any value).</summary>
    Unsupported,

    /// <summary>Always safe to send (gpt-4o, gpt-4.1, Claude Haiku 4.5).</summary>
    Supported,

    /// <summary>Only send while the resolved reasoning effort is <see cref="ReasoningEffort.None"/> (gpt-5.x).</summary>
    SupportedWhenReasoningDisabled
}
