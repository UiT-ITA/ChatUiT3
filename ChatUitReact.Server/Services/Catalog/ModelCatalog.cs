using System;
using System.Collections.Generic;
using System.Linq;

namespace ChatUitReact.Server.Services.Catalog;

using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.TokenCounting;

/// <summary>
/// A known model and the capabilities it ships with.
/// </summary>
public sealed record CatalogModel(
    string ModelId,
    string DisplayName,
    string Description,
    EndpointType Provider,
    ModelCapabilities Capabilities);

/// <summary>
/// Capability defaults for models we have verified against provider documentation.
///
/// This is a <em>prefill</em>, never authoritative: the stored model row decides what is sent
/// at request time, so an admin can register a preview or self-hosted model that is absent
/// here, and a deploy cannot silently change how a production model behaves. Its job is to
/// stop a mistyped capability checkbox from becoming a runtime 400 such as
/// "'temperature' does not support 0.7 with this model".
///
/// Adding a newly released model is one entry here.
/// </summary>
public static class ModelCatalog
{
    public static IReadOnlyList<CatalogModel> All { get; } = Build();

    public static CatalogModel? Find(string modelId) =>
        All.FirstOrDefault(m => string.Equals(m.ModelId, modelId, StringComparison.OrdinalIgnoreCase));

    private static List<CatalogModel> Build() =>
    [
        // ---- OpenAI / Azure OpenAI -------------------------------------------------
        // The gpt-5.x family accepts a temperature only while reasoning.effort is "none".
        // The 5.6 family adds "max" above "xhigh"; all three variants share the same
        // context window, output ceiling and cutoff, and differ only in cost and depth.
        new("gpt-5.6-sol", "GPT-5.6 Sol", "Most capable OpenAI model; deepest reasoning.", EndpointType.AzureOpenAI, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.SupportedWhenReasoningDisabled,
            SupportedEfforts = Efforts(ReasoningEffort.None, ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_050_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            KnowledgeCutoff = new DateTime(2026, 2, 16),
            TokenCountingScheme = TokenCountingSchemes.O200kTile
        }),

        new("gpt-5.6-terra", "GPT-5.6 Terra", "Strong performance at lower cost than Sol.", EndpointType.AzureOpenAI, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.SupportedWhenReasoningDisabled,
            SupportedEfforts = Efforts(ReasoningEffort.None, ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_050_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            KnowledgeCutoff = new DateTime(2026, 2, 16),
            TokenCountingScheme = TokenCountingSchemes.O200kTile
        }),

        new("gpt-5.6-luna", "GPT-5.6 Luna", "Efficient model for high-volume workloads.", EndpointType.AzureOpenAI, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.SupportedWhenReasoningDisabled,
            SupportedEfforts = Efforts(ReasoningEffort.None, ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_050_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            KnowledgeCutoff = new DateTime(2026, 2, 16),
            TokenCountingScheme = TokenCountingSchemes.O200kTile
        }),

        new("gpt-5.5", "GPT-5.5", "Previous-generation OpenAI reasoning model.", EndpointType.AzureOpenAI, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.SupportedWhenReasoningDisabled,
            SupportedEfforts = Efforts(ReasoningEffort.None, ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh),
            MaxContextTokens = 1_050_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            KnowledgeCutoff = new DateTime(2025, 12, 1),
            TokenCountingScheme = TokenCountingSchemes.O200kTile
        }),

        new("gpt-5.4", "GPT-5.4", "Reasoning-heavy work that needs deliberate control.", EndpointType.AzureOpenAI, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.SupportedWhenReasoningDisabled,
            SupportedEfforts = Efforts(ReasoningEffort.None, ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh),
            MaxContextTokens = 1_050_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            KnowledgeCutoff = new DateTime(2025, 8, 31),
            TokenCountingScheme = TokenCountingSchemes.O200kTile
        }),

        new("gpt-5.4-mini", "GPT-5.4 Mini", "Faster, cheaper reasoning model.", EndpointType.AzureOpenAI, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.SupportedWhenReasoningDisabled,
            SupportedEfforts = Efforts(ReasoningEffort.None, ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh),
            MaxContextTokens = 400_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            KnowledgeCutoff = new DateTime(2025, 8, 31),
            TokenCountingScheme = TokenCountingSchemes.O200kPatch(1.62)
        }),

        new("gpt-4.1", "GPT-4.1", "Fast non-reasoning model with a very large context window.", EndpointType.AzureOpenAI, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Supported,
            SupportedEfforts = Efforts(),
            MaxContextTokens = 1_047_576,
            MaxOutputTokens = 32_768,
            DefaultMaxOutputTokens = 32_768,
            KnowledgeCutoff = new DateTime(2024, 6, 1),
            TokenCountingScheme = TokenCountingSchemes.O200kTile
        }),

        new("gpt-4o", "GPT-4o", "General-purpose non-reasoning model.", EndpointType.AzureOpenAI, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Supported,
            SupportedEfforts = Efforts(),
            MaxContextTokens = 128_000,
            MaxOutputTokens = 16_384,
            DefaultMaxOutputTokens = 16_384,
            KnowledgeCutoff = new DateTime(2023, 10, 1),
            TokenCountingScheme = TokenCountingSchemes.O200kTile
        }),

        // ---- Anthropic --------------------------------------------------------------
        // Models after Claude Opus 4.6 reject any non-default temperature with a 400.
        // Fable 5 and Opus 5 always reason, so their effort ladders deliberately omit
        // "None" — asking Fable 5 not to think is a 400, not a slower answer.
        new("claude-fable-5", "Claude Fable 5", "Anthropic's most capable model; hardest reasoning and long-horizon agentic work.", EndpointType.Anthropic, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Unsupported,
            SupportedEfforts = Efforts(ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_000_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000
        }),

        new("claude-opus-5", "Claude Opus 5", "Most capable Claude model for agentic and long-horizon work.", EndpointType.Anthropic, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Unsupported,
            SupportedEfforts = Efforts(ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_000_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000
        }),

        new("claude-sonnet-5", "Claude Sonnet 5", "Near-Opus quality on coding and agentic work, at Sonnet cost.", EndpointType.Anthropic, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Unsupported,
            SupportedEfforts = Efforts(ReasoningEffort.None, ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_000_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000
        }),

        new("claude-opus-4-8", "Claude Opus 4.8", "Previous-generation Opus.", EndpointType.Anthropic, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Unsupported,
            SupportedEfforts = Efforts(ReasoningEffort.None, ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_000_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000
        }),

        // Pre-4.6, so this one still accepts a temperature.
        new("claude-haiku-4-5", "Claude Haiku 4.5", "Fastest and cheapest Claude model.", EndpointType.Anthropic, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Supported,
            SupportedEfforts = Efforts(ReasoningEffort.None, ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High),
            MaxContextTokens = 200_000,
            MaxOutputTokens = 64_000,
            DefaultMaxOutputTokens = 16_000,
        })
    ];

    private static List<ReasoningEffort> Efforts(params ReasoningEffort[] efforts) => efforts.ToList();
}
