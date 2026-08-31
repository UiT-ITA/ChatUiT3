using System.Threading;
using System.Threading.Tasks;

namespace ChatUitReact.Server.Services.AiProviders;

using ChatUitReact.Server.Models;

/// <summary>
/// One AI provider. Implementations translate an <see cref="AiRequest"/> into their own
/// wire format and back — they do not decide what a model supports (the
/// <see cref="ChatParameterResolver"/> has already done that) and they do not run the
/// tool-call loop (<see cref="AiConversationRunner"/> does).
///
/// Adding a provider means adding one class and registering it; nothing dispatches on
/// <see cref="EndpointType"/> outside the registry.
/// </summary>
public interface IAiProvider
{
    EndpointType EndpointType { get; }

    IAiConversation StartConversation(AiRequest request);

    /// <summary>Generates a chat name with a single non-streamed, length-bounded completion.</summary>
    Task<string> GenerateChatNameAsync(AiRequest request, CancellationToken cancellationToken = default);
}

/// <summary>Resolves the provider registered for an endpoint's type.</summary>
public interface IAiProviderRegistry
{
    /// <summary>Throws <see cref="NotSupportedException"/> when no provider handles the type.</summary>
    IAiProvider For(EndpointType endpointType);

    bool Supports(EndpointType endpointType);
}
