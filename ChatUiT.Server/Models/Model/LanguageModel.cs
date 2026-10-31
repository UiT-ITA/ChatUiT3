using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;

namespace ChatUiT.Server.Models;

/// <summary>A model that reads and writes text: the model behind chats, assistants and the Responses API.</summary>
public class LanguageModel : Model
{
    public override ModelType Type => ModelType.Language;

    /// <summary>
    /// Whether a user may pin an assistant on this model as their default assistant for new
    /// chats. A cost control, not a capability: it says nothing about what the model can do,
    /// only that the operator is willing to have it run unprompted on every new conversation.
    /// </summary>
    public bool AllowedAsDefault { get; set; } = false;

    /// <summary>
    /// Whether the Responses API serves this model, under its <see cref="Model.ModelId"/>, to callers
    /// with one of its <see cref="Model.AllowedRoles"/>.
    /// </summary>
    public bool ExposedInApi { get; set; } = false;

    public LanguageModelCapabilities Capabilities { get; set; } = new LanguageModelCapabilities();

    /// <summary>How this model is spoken to on the wire.</summary>
    public ApiProtocol ApiProtocol { get; set; }

    /// <summary>Which data may be put into the model.</summary>
    public DataClassification Classification { get; set; } = DataClassification.Green;
}

/// <summary>
/// What a single language model supports. Provider protocol differences (where the system prompt
/// goes, how tool results are shaped) deliberately live in the provider adapters, not here —
/// this type only describes per-model variation.
/// </summary>
public class LanguageModelCapabilities
{
    public bool SupportsVision { get; set; } = false;

    public bool SupportsFunctionCalling { get; set; } = false;

    public TemperatureSupport Temperature { get; set; } = TemperatureSupport.Unsupported;

    /// <summary>
    /// The reasoning levels this model accepts, in ascending order.
    /// Empty means the model does not reason at all. Containing <see cref="ReasoningEffort.None"/>
    /// means reasoning can be switched off; omitting it means reasoning is always on
    /// (Claude Opus 5 rejects a request that disables thinking above "high" effort).
    /// </summary>
    public List<ReasoningEffort> SupportedEfforts { get; set; } = new List<ReasoningEffort>();

    /// <summary>Context window. Informational — nothing on the server enforces it today.</summary>
    public int MaxContextTokens { get; set; } = 16_000;

    /// <summary>The model's own output ceiling. Requests are clamped to this.</summary>
    public int MaxOutputTokens { get; set; } = 16_000;

    /// <summary>
    /// What Anthropic requests send as <c>max_tokens</c>, which that API requires.
    /// Azure OpenAI requests send no output limit.
    /// </summary>
    public int DefaultMaxOutputTokens { get; set; } = 16_000;

    /// <summary>Null when unknown — <c>DateTime.MinValue</c> as a sentinel is a trap.</summary>
    public DateTime? KnowledgeCutoff { get; set; }

    /// <summary>
    /// How tokens are counted for this model's context-window meter; ids are defined in
    /// <c>TokenCountingSchemes</c>. Null when no counter is available for the model.
    /// </summary>
    public string? TokenCountingScheme { get; set; }

    [JsonIgnore]
    public bool SupportsReasoning => SupportedEfforts.Count > 0;

    /// <summary>False when the model always reasons and cannot be asked not to.</summary>
    [JsonIgnore]
    public bool CanDisableReasoning => SupportedEfforts.Contains(ReasoningEffort.None);

    /// <summary>The weakest reasoning level this model will accept, used when clamping.</summary>
    [JsonIgnore]
    public ReasoningEffort LowestEffort =>
        SupportedEfforts.Count == 0 ? ReasoningEffort.None : SupportedEfforts.Min();

    public bool SupportsEffort(ReasoningEffort effort) =>
        effort == ReasoningEffort.None ? !SupportsReasoning || CanDisableReasoning : SupportedEfforts.Contains(effort);

    /// <summary>
    /// Maps a requested effort onto the nearest level this model accepts. A model that
    /// cannot reason always resolves to <see cref="ReasoningEffort.None"/>; a model that
    /// always reasons resolves a requested "None" up to its weakest level rather than
    /// being silently rewritten to something arbitrary.
    /// </summary>
    public ReasoningEffort ClampEffort(ReasoningEffort requested)
    {
        if (!SupportsReasoning)
        {
            return ReasoningEffort.None;
        }

        if (SupportedEfforts.Contains(requested))
        {
            return requested;
        }

        if (requested == ReasoningEffort.None)
        {
            return LowestEffort;
        }

        // Step down to the strongest supported level at or below the request, so asking
        // for more reasoning than a model offers never quietly asks for less than intended.
        var below = SupportedEfforts.Where(e => e != ReasoningEffort.None && e < requested).ToList();
        return below.Count > 0 ? below.Max() : SupportedEfforts.Where(e => e != ReasoningEffort.None).DefaultIfEmpty(ReasoningEffort.None).Min();
    }
}
