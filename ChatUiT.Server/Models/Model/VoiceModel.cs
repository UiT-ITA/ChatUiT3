using System.Text.Json.Serialization;

namespace ChatUiT.Server.Models;

/// <summary>A model that turns text into speech. No voice API is implemented yet.</summary>
public class VoiceModel : Model
{
    public override ModelType Type => ModelType.Voice;

    public VoiceApi VoiceApi { get; set; }

    public VoiceModelCapabilities Capabilities { get; set; } = new VoiceModelCapabilities();
}

/// <summary>The wire API a voice model is called with. None is implemented yet.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum VoiceApi
{
}

/// <summary>What a single voice model supports.</summary>
public class VoiceModelCapabilities
{
}
