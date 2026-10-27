using System;
using System.Collections.Generic;
using System.Linq;

namespace ChatUiT.Server.Services.Catalog;

using ChatUiT.Server.Models;
using ChatUiT.Server.Services.TokenCounting;

/// <summary>
/// A known model: the host it was verified on, the protocol it answers on, and the
/// capabilities it ships with.
/// </summary>
public sealed record CatalogModel(
    string ModelId,
    string DisplayName,
    string Description,
    EndpointType Provider,
    ApiProtocol ApiProtocol,
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
/// Adding a newly released model is one entry here: host, protocol, capabilities, tokenizer.
/// </summary>
public static class ModelCatalog
{
    public static IReadOnlyList<CatalogModel> All { get; } = Build();

    public static CatalogModel? Find(string modelId) =>
        All.FirstOrDefault(m => string.Equals(m.ModelId, modelId, StringComparison.OrdinalIgnoreCase));

    private static List<CatalogModel> Build() =>
    [
        // ---- OpenAI models on Microsoft Foundry (Responses API) ---------------------
        // GPT-6 keeps the gpt-5.x temperature rule. GPT-6 Astra and GPT-6.1 Sol reject
        // "none" with a 400, so they cannot switch reasoning off and never get a temperature.
        // No GPT-6 tokenizer is documented; o200k is the closest known encoding.
        new("gpt-6.1-sol", "GPT-6.1 Sol", "Near-Astra performance for complex work at a lower cost.", EndpointType.MicrosoftFoundry, ApiProtocol.OpenAiResponses, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Unsupported,
            SupportedEfforts = Efforts(ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_050_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            KnowledgeCutoff = new DateTime(2026, 4, 30),
            TokenCountingScheme = TokenCountingSchemes.O200kTile
        }),

        new("gpt-6-sol", "GPT-6 Sol", "Built for complex coding and agentic workflows.", EndpointType.MicrosoftFoundry, ApiProtocol.OpenAiResponses, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.SupportedWhenReasoningDisabled,
            SupportedEfforts = Efforts(ReasoningEffort.None, ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_050_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            KnowledgeCutoff = new DateTime(2026, 4, 20),
            TokenCountingScheme = TokenCountingSchemes.O200kTile
        }),

        new("gpt-6-luna", "GPT-6 Luna", "Most efficient GPT-6 model for focused, high-volume tasks.", EndpointType.MicrosoftFoundry, ApiProtocol.OpenAiResponses, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.SupportedWhenReasoningDisabled,
            SupportedEfforts = Efforts(ReasoningEffort.None, ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_050_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            KnowledgeCutoff = new DateTime(2026, 5, 18),
            TokenCountingScheme = TokenCountingSchemes.O200kTile
        }),

        new("gpt-6-astra", "GPT-6 Astra", "Most capable OpenAI model for the most demanding work.", EndpointType.MicrosoftFoundry, ApiProtocol.OpenAiResponses, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Unsupported,
            SupportedEfforts = Efforts(ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_050_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            KnowledgeCutoff = new DateTime(2026, 4, 30),
            TokenCountingScheme = TokenCountingSchemes.O200kTile
        }),

        // A preview alias that tracks ChatGPT's Instant model. Its reasoning level is fixed
        // and cannot be set, so it gets no effort ladder and no reasoning options are sent.
        // Temperature support is undocumented, so none is sent.
        new("gpt-chat-latest", "GPT Chat Latest", "Preview alias for the latest Instant model used in ChatGPT.", EndpointType.MicrosoftFoundry, ApiProtocol.OpenAiResponses, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Unsupported,
            SupportedEfforts = Efforts(),
            MaxContextTokens = 400_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            KnowledgeCutoff = new DateTime(2026, 2, 1),
            TokenCountingScheme = TokenCountingSchemes.O200kTile
        }),

        // The gpt-5.x family accepts a temperature only while reasoning.effort is "none".
        // The 5.6 family adds "max" above "xhigh"; all three variants share the same
        // context window, output ceiling and cutoff, and differ only in cost and depth.
        new("gpt-5.6-sol", "GPT-5.6 Sol", "Most capable OpenAI model; deepest reasoning.", EndpointType.MicrosoftFoundry, ApiProtocol.OpenAiResponses, new ModelCapabilities
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

        new("gpt-5.6-terra", "GPT-5.6 Terra", "Strong performance at lower cost than Sol.", EndpointType.MicrosoftFoundry, ApiProtocol.OpenAiResponses, new ModelCapabilities
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

        new("gpt-5.6-luna", "GPT-5.6 Luna", "Efficient model for high-volume workloads.", EndpointType.MicrosoftFoundry, ApiProtocol.OpenAiResponses, new ModelCapabilities
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

        new("gpt-5.5", "GPT-5.5", "Previous-generation OpenAI reasoning model.", EndpointType.MicrosoftFoundry, ApiProtocol.OpenAiResponses, new ModelCapabilities
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

        new("gpt-5.4", "GPT-5.4", "Reasoning-heavy work that needs deliberate control.", EndpointType.MicrosoftFoundry, ApiProtocol.OpenAiResponses, new ModelCapabilities
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

        new("gpt-5.4-mini", "GPT-5.4 Mini", "Faster, cheaper reasoning model.", EndpointType.MicrosoftFoundry, ApiProtocol.OpenAiResponses, new ModelCapabilities
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

        new("gpt-4.1", "GPT-4.1", "Fast non-reasoning model with a very large context window.", EndpointType.MicrosoftFoundry, ApiProtocol.OpenAiResponses, new ModelCapabilities
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

        new("gpt-4o", "GPT-4o", "General-purpose non-reasoning model.", EndpointType.MicrosoftFoundry, ApiProtocol.OpenAiResponses, new ModelCapabilities
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
        // Models after Opus 5 think adaptively by default, and a "None" request sends no
        // thinking field, so "None" would not switch thinking off: their ladders omit it.
        new("claude-haiku-5-5", "Claude Haiku 5.5", "For high-volume, latency-sensitive tasks such as classification, extraction, and routing.", EndpointType.Anthropic, ApiProtocol.AnthropicMessages, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Unsupported,
            SupportedEfforts = Efforts(ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_000_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            KnowledgeCutoff = new DateTime(2026, 6, 1),
            TokenCountingScheme = TokenCountingSchemes.AnthropicEstimate
        }),

        new("claude-sonnet-5-5", "Claude Sonnet 5.5", "The best combination of speed and intelligence.", EndpointType.Anthropic, ApiProtocol.AnthropicMessages, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Unsupported,
            SupportedEfforts = Efforts(ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_000_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            KnowledgeCutoff = new DateTime(2026, 6, 1),
            TokenCountingScheme = TokenCountingSchemes.AnthropicEstimate
        }),

        new("claude-opus-5-5", "Claude Opus 5.5", "For long-running agentic coding and knowledge work.", EndpointType.Anthropic, ApiProtocol.AnthropicMessages, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Unsupported,
            SupportedEfforts = Efforts(ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_000_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            KnowledgeCutoff = new DateTime(2026, 6, 1),
            TokenCountingScheme = TokenCountingSchemes.AnthropicEstimate
        }),

        new("claude-fable-5-1", "Claude Fable 5.1", "For demanding reasoning and long-horizon agentic work.", EndpointType.Anthropic, ApiProtocol.AnthropicMessages, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Unsupported,
            SupportedEfforts = Efforts(ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_000_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            KnowledgeCutoff = new DateTime(2026, 6, 1),
            TokenCountingScheme = TokenCountingSchemes.AnthropicEstimate
        }),

        new("claude-mythos-5-1", "Claude Mythos 5.1", "Same capabilities as Claude Fable 5.1. Requires Anthropic organization verification.", EndpointType.Anthropic, ApiProtocol.AnthropicMessages, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Unsupported,
            SupportedEfforts = Efforts(ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_000_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            KnowledgeCutoff = new DateTime(2026, 6, 1),
            TokenCountingScheme = TokenCountingSchemes.AnthropicEstimate
        }),

        // Fable 5 and Opus 5 always reason, so their effort ladders deliberately omit
        // "None" — asking Fable 5 not to think is a 400, not a slower answer.
        new("claude-fable-5", "Claude Fable 5", "Anthropic's most capable model; hardest reasoning and long-horizon agentic work.", EndpointType.Anthropic, ApiProtocol.AnthropicMessages, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Unsupported,
            SupportedEfforts = Efforts(ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_000_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            TokenCountingScheme = TokenCountingSchemes.AnthropicEstimate
        }),

        new("claude-opus-5", "Claude Opus 5", "Most capable Claude model for agentic and long-horizon work.", EndpointType.Anthropic, ApiProtocol.AnthropicMessages, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Unsupported,
            SupportedEfforts = Efforts(ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_000_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            TokenCountingScheme = TokenCountingSchemes.AnthropicEstimate
        }),

        new("claude-sonnet-5", "Claude Sonnet 5", "Near-Opus quality on coding and agentic work, at Sonnet cost.", EndpointType.Anthropic, ApiProtocol.AnthropicMessages, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Unsupported,
            SupportedEfforts = Efforts(ReasoningEffort.None, ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_000_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            TokenCountingScheme = TokenCountingSchemes.AnthropicEstimate
        }),

        new("claude-opus-4-8", "Claude Opus 4.8", "Previous-generation Opus.", EndpointType.Anthropic, ApiProtocol.AnthropicMessages, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Unsupported,
            SupportedEfforts = Efforts(ReasoningEffort.None, ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High, ReasoningEffort.XHigh, ReasoningEffort.Max),
            MaxContextTokens = 1_000_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            TokenCountingScheme = TokenCountingSchemes.AnthropicEstimate
        }),

        // Pre-4.6, so this one still accepts a temperature.
        new("claude-haiku-4-5", "Claude Haiku 4.5", "Fastest and cheapest Claude model.", EndpointType.Anthropic, ApiProtocol.AnthropicMessages, new ModelCapabilities
        {
            SupportsVision = true,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Supported,
            SupportedEfforts = Efforts(ReasoningEffort.None, ReasoningEffort.Low, ReasoningEffort.Medium, ReasoningEffort.High),
            MaxContextTokens = 200_000,
            MaxOutputTokens = 64_000,
            DefaultMaxOutputTokens = 16_000,
            TokenCountingScheme = TokenCountingSchemes.AnthropicEstimate
        }),

        // ---- DeepSeek on Microsoft Foundry (Chat Completions) -----------------------
        // Foundry serves DeepSeek deployments on /openai/v1/chat/completions with reasoning
        // content, text only, and documents no thinking toggle or effort control — hence the
        // single always-on level. The model id is the Foundry deployment name. Microsoft's
        // docs disagree on the output ceiling (128k on the model card, 384k in the table);
        // the smaller figure is used. No public tokenizer, so a character estimate.
        new("DeepSeek-V4-Flash", "DeepSeek V4 Flash", "DeepSeek's fast reasoning model, hosted by Azure.", EndpointType.MicrosoftFoundry, ApiProtocol.OpenAiChatCompletions, new ModelCapabilities
        {
            SupportsVision = false,
            SupportsFunctionCalling = true,
            Temperature = TemperatureSupport.Unsupported,
            SupportedEfforts = Efforts(ReasoningEffort.High),
            MaxContextTokens = 1_000_000,
            MaxOutputTokens = 128_000,
            DefaultMaxOutputTokens = 32_000,
            KnowledgeCutoff = null,
            TokenCountingScheme = TokenCountingSchemes.CharEstimate(4)
        })
    ];

    private static List<ReasoningEffort> Efforts(params ReasoningEffort[] efforts) => efforts.ToList();
}
