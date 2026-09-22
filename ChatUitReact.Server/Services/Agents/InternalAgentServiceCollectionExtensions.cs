using ChatUitReact.Server.Services.Agents.M365;
using ChatUitReact.Server.Services.Tools;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ChatUitReact.Server.Services.Agents;

public static class InternalAgentServiceCollectionExtensions
{
    /// <summary>
    /// Registers the internal agents. Each agent becomes one <see cref="ITool"/> in the registry,
    /// so policies, the admin page and the assistant editor treat it like any other tool.
    /// </summary>
    public static IServiceCollection AddInternalAgents(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<InternalAgentOptions>(configuration.GetSection(InternalAgentOptions.SectionName));
        services.AddSingleton<InternalAgentRunner>();

        services.AddM365Agents();

        return services;
    }

    public static IServiceCollection AddInternalAgent<TAgent>(this IServiceCollection services) where TAgent : InternalAgent
    {
        services.AddSingleton<TAgent>();
        services.AddSingleton<ITool>(sp => new InternalAgentTool(sp.GetRequiredService<TAgent>(), sp.GetRequiredService<InternalAgentRunner>()));
        return services;
    }
}
