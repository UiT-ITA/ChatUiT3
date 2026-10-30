using System;
using System.Threading;
using System.Threading.Tasks;
using Azure.Core;

namespace ChatUiT.Server.Services.AiProviders.Protocols;

using ChatUiT.Server.Models;

/// <summary>
/// Where a protocol adapter sends its requests: the base URL the host provider composed for
/// this protocol, and the key from the endpoint row. A null URL means the SDK default (only
/// the Anthropic adapter has one); the OpenAI adapters require a URL. When
/// <paramref name="Credential"/> is set, requests carry an Entra bearer token for
/// <see cref="AzureAiAuth.Scope"/> instead of the key.
/// </summary>
public sealed record ProtocolTarget(string? BaseUrl, string ApiKey, TokenCredential? Credential = null);

public static class AzureAiAuth
{
    /// <summary>The token scope Microsoft Foundry and Azure OpenAI accept for OpenAI and Anthropic requests.</summary>
    public const string Scope = "https://ai.azure.com/.default";
}

/// <summary>
/// One wire protocol. Adapters translate an <see cref="AiRequest"/> into the SDK's shapes
/// and back — they do not know which host they talk to (the <see cref="IAiProvider"/> does,
/// and hands them a <see cref="ProtocolTarget"/>), they do not decide what a model supports
/// (<see cref="ChatParameterResolver"/> has), and they do not run the tool loop
/// (<see cref="AiConversationRunner"/> does).
/// </summary>
public interface IApiProtocol
{
    ApiProtocol Protocol { get; }

    IAiConversation StartConversation(AiRequest request, ProtocolTarget target);

    /// <summary>Generates a chat name with a single non-streamed, length-bounded completion.</summary>
    Task<string> GenerateChatNameAsync(AiRequest request, ProtocolTarget target, CancellationToken cancellationToken = default);
}

/// <summary>Resolves the adapter registered for a protocol.</summary>
public interface IApiProtocolRegistry
{
    /// <summary>Throws <see cref="NotSupportedException"/> when no adapter handles the protocol.</summary>
    IApiProtocol For(ApiProtocol protocol);
}

public static class ApiProtocols
{
    /// <summary>
    /// The protocol a model row declares. A row saved before protocols were per model has
    /// none; that is reported, not guessed, because guessing sends the model to an API that
    /// returns an opaque 400 or, worse, answers differently.
    /// </summary>
    public static ApiProtocol Require(Model model) =>
        model.ApiProtocol ?? throw new InvalidOperationException(
            $"Model '{model.ModelName}' ({model.ModelId}) has no API protocol. Set one in the admin panel under Models.");
}
