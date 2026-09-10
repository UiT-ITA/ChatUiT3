using System;
using System.Collections.Generic;
using System.Linq;

namespace ChatUitReact.Server.Services.AiProviders.Protocols;

using ChatUitReact.Server.Models;

/// <summary>
/// Maps protocols to the registered adapter. Built from whatever <see cref="IApiProtocol"/>
/// implementations DI supplies, so registering an adapter is the only step needed.
/// </summary>
public sealed class ApiProtocolRegistry : IApiProtocolRegistry
{
    private readonly Dictionary<ApiProtocol, IApiProtocol> _protocols;

    public ApiProtocolRegistry(IEnumerable<IApiProtocol> protocols)
    {
        _protocols = protocols.ToDictionary(p => p.Protocol);
    }

    public IApiProtocol For(ApiProtocol protocol)
    {
        if (_protocols.TryGetValue(protocol, out var adapter))
        {
            return adapter;
        }

        throw new NotSupportedException(
            $"No adapter is registered for API protocol {protocol}. " +
            $"Registered protocols: {string.Join(", ", _protocols.Keys)}.");
    }
}
