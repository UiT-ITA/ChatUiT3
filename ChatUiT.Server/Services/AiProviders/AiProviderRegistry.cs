using System;
using System.Collections.Generic;
using System.Linq;

namespace ChatUiT.Server.Services.AiProviders;

using ChatUiT.Server.Models;

/// <summary>
/// Maps endpoint types to the registered host provider. Built from whatever
/// <see cref="IAiProvider"/> implementations DI supplies, so registering a provider is the
/// only step needed to make its endpoint type usable.
/// </summary>
public sealed class AiProviderRegistry : IAiProviderRegistry
{
    private readonly Dictionary<EndpointType, IAiProvider> _providers;

    public AiProviderRegistry(IEnumerable<IAiProvider> providers)
    {
        _providers = providers.ToDictionary(p => p.EndpointType);
    }

    public bool Supports(EndpointType endpointType) => _providers.ContainsKey(endpointType);

    public IAiProvider For(EndpointType endpointType)
    {
        if (_providers.TryGetValue(endpointType, out var provider))
        {
            return provider;
        }

        throw new NotSupportedException(
            $"No AI provider is registered for endpoint type {endpointType}. " +
            $"Registered types: {string.Join(", ", _providers.Keys)}.");
    }
}
