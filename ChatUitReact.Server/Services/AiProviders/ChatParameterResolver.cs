using System;
using System.Collections.Generic;

namespace ChatUitReact.Server.Services.AiProviders;

using ChatUitReact.Server.Models;

/// <summary>
/// Turns an assistant's settings into parameters the selected model will actually accept.
///
/// This is the single place that knows the rules, so a valid-looking assistant cannot
/// produce an HTTP 400 such as "'temperature' does not support 0.7 with this model".
/// Deliberately pure and provider-agnostic: anything protocol-specific (Anthropic's 0–1
/// temperature range, how thinking is expressed on the wire) belongs in the provider.
/// </summary>
public static class ChatParameterResolver
{
    public static ResolvedChatParameters Resolve(ModelCapabilities capabilities, ChatSettings settings)
    {
        ArgumentNullException.ThrowIfNull(capabilities);
        ArgumentNullException.ThrowIfNull(settings);

        var effort = capabilities.ClampEffort(settings.ReasoningEffort);

        return new ResolvedChatParameters
        {
            Temperature = ResolveTemperature(capabilities, settings.Temperature, effort),
            Effort = effort,
            MaxOutputTokens = ResolveMaxOutputTokens(capabilities),
            ToolIds = capabilities.SupportsFunctionCalling
                ? settings.AvailableToolIds ?? new List<string>()
                : new List<string>(),
            AllowImages = capabilities.SupportsVision
        };
    }

    private static float? ResolveTemperature(ModelCapabilities capabilities, float requested, ReasoningEffort effort)
    {
        return capabilities.Temperature switch
        {
            TemperatureSupport.Supported => requested,
            // gpt-5.x accepts a temperature only while reasoning is switched off; sending
            // one alongside an active effort returns 400.
            TemperatureSupport.SupportedWhenReasoningDisabled when effort == ReasoningEffort.None => requested,
            _ => null
        };
    }

    private static int ResolveMaxOutputTokens(ModelCapabilities capabilities)
    {
        var ceiling = capabilities.MaxOutputTokens > 0 ? capabilities.MaxOutputTokens : DefaultOutputTokens;
        var requested = capabilities.DefaultMaxOutputTokens > 0 ? capabilities.DefaultMaxOutputTokens : ceiling;

        return Math.Min(requested, ceiling);
    }

    /// <summary>Fallback for a model row saved without any output limit.</summary>
    private const int DefaultOutputTokens = 16_000;
}
