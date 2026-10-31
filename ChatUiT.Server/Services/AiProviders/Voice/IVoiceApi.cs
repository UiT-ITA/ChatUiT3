namespace ChatUiT.Server.Services.AiProviders.Voice;

using ChatUiT.Server.Models;

/// <summary>
/// One voice API, the counterpart of <see cref="Images.IImageApi"/> for <see cref="VoiceModel"/>.
/// No voice API is implemented yet.
/// </summary>
public interface IVoiceApi
{
    VoiceApi Api { get; }
}
