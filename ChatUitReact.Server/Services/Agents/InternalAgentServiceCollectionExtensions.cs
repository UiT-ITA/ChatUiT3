using ChatUitReact.Server.Services.Agents.Dev;
using ChatUitReact.Server.Services.Agents.M365;
using ChatUitReact.Server.Services.Agents.Office;
using ChatUitReact.Server.Services.Tools;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace ChatUitReact.Server.Services.Agents;

public static class InternalAgentServiceCollectionExtensions
{
    /// <summary>Registers the internal agents, their registry and settings. The probe agent exists in Development only.</summary>
    public static IServiceCollection AddInternalAgents(this IServiceCollection services, IHostEnvironment environment)
    {
        services.AddSingleton<InternalAgentRunner>();
        services.AddSingleton<InternalAgentSettingsService>();
        services.AddSingleton<IInternalAgentRegistry, InternalAgentRegistry>();

        services.AddM365Agents();
        services.AddInternalAgent<WordAgent>();

        if (environment.IsDevelopment())
        {
            services.AddInternalAgent<DevProbeAgent>();
        }

        return services;
    }

    /// <summary>Registers an agent definition. It is not callable as a tool unless <see cref="AddInternalAgentTool{TAgent}"/> is also called.</summary>
    public static IServiceCollection AddInternalAgent<TAgent>(this IServiceCollection services) where TAgent : InternalAgent
    {
        services.AddSingleton<TAgent>();
        services.AddSingleton<InternalAgent>(sp => sp.GetRequiredService<TAgent>());
        return services;
    }

    /// <summary>
    /// Registers the <see cref="InternalAgentTool"/> that calls the agent, keyed by the agent's
    /// type, and puts that same instance in the tool registry. Another agent takes it as a
    /// function with <c>[FromKeyedServices(typeof(TAgent))]</c>.
    /// </summary>
    public static IServiceCollection AddInternalAgentTool<TAgent>(this IServiceCollection services) where TAgent : InternalAgent
    {
        services.AddKeyedSingleton<InternalAgentTool>(typeof(TAgent), (sp, _) => new InternalAgentTool(sp.GetRequiredService<TAgent>(), sp.GetRequiredService<InternalAgentRunner>()));
        services.AddSingleton<ITool>(sp => sp.GetRequiredKeyedService<InternalAgentTool>(typeof(TAgent)));
        return services;
    }
}
