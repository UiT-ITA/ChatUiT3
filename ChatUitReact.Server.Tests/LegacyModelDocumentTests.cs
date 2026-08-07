using ChatUitReact.Server.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Converters;

namespace ChatUitReact.Server.Tests;

/// <summary>
/// The capability shape changed, so model rows written before it no longer match. This pins
/// down what happens to them: Cosmos uses Newtonsoft, which ignores unknown keys and leaves
/// missing ones at their default — so an old row loads with blank capabilities rather than
/// taking down every model read. Re-saving the model from the catalog picker restores it.
///
/// Mirrors ModelCapabilitiesDocument, which is private to DatabaseService.
/// </summary>
public class LegacyModelDocumentTests
{
    private sealed class CapabilitiesDocument
    {
        [JsonProperty("supportsVision")]
        public bool SupportsVision { get; set; }

        [JsonProperty("supportsFunctionCalling")]
        public bool SupportsFunctionCalling { get; set; }

        [JsonProperty("temperature")]
        [JsonConverter(typeof(StringEnumConverter))]
        public TemperatureSupport Temperature { get; set; }

        [JsonProperty("supportedEfforts", ItemConverterType = typeof(StringEnumConverter))]
        public List<ReasoningEffort> SupportedEfforts { get; set; } = new();

        [JsonProperty("maxOutputTokens")]
        public int MaxOutputTokens { get; set; }

        [JsonProperty("knowledgeCutoff")]
        public DateTime? KnowledgeCutoff { get; set; }
    }

    private const string LegacyJson = """
    {
      "supportsVision": true,
      "supportsReasoning": true,
      "supportsFunctionCalling": true,
      "supportsTemperature": true,
      "maxContextLength": 400000,
      "maxOutputLength": 128000,
      "knowledgeCutoff": "2024-06-01T00:00:00Z"
    }
    """;

    [Fact]
    public void ALegacyRow_LoadsWithoutThrowing()
    {
        // If this threw, it would happen inside the query that loads *every* model.
        var document = JsonConvert.DeserializeObject<CapabilitiesDocument>(LegacyJson);

        Assert.NotNull(document);
    }

    [Fact]
    public void ALegacyRow_KeepsFieldsWhoseKeyDidNotChange()
    {
        var document = JsonConvert.DeserializeObject<CapabilitiesDocument>(LegacyJson)!;

        Assert.True(document.SupportsVision);
        Assert.True(document.SupportsFunctionCalling);
        Assert.Equal(new DateTime(2024, 6, 1, 0, 0, 0, DateTimeKind.Utc), document.KnowledgeCutoff!.Value.ToUniversalTime());
    }

    [Fact]
    public void ALegacyRow_LosesTheFieldsThatWereReshaped()
    {
        // These are what the admin has to re-pick; the old keys carry no usable value.
        var document = JsonConvert.DeserializeObject<CapabilitiesDocument>(LegacyJson)!;

        Assert.Equal(TemperatureSupport.Unsupported, document.Temperature);
        Assert.Empty(document.SupportedEfforts);
        Assert.Equal(0, document.MaxOutputTokens);
    }

    [Fact]
    public void ReasoningEffort_RoundTripsAsAString()
    {
        // Written as names rather than ordinals, so reordering the enum can no longer
        // silently reinterpret stored assistants.
        var json = JsonConvert.SerializeObject(new CapabilitiesDocument
        {
            SupportedEfforts = new List<ReasoningEffort> { ReasoningEffort.None, ReasoningEffort.XHigh }
        });

        Assert.Contains("\"None\"", json);
        Assert.Contains("\"XHigh\"", json);

        var round = JsonConvert.DeserializeObject<CapabilitiesDocument>(json)!;
        Assert.Equal(new[] { ReasoningEffort.None, ReasoningEffort.XHigh }, round.SupportedEfforts);
    }
}
