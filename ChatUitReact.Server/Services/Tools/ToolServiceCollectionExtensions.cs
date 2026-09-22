using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ChatUitReact.Server.Services.Tools;

public static class ToolServiceCollectionExtensions
{
    /// <summary>
    /// Registers the tool system. Adding a server tool is one line here: the registry picks
    /// up every <see cref="ITool"/> in the container and validates its id at startup.
    /// </summary>
    public static IServiceCollection AddTools(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<ToolOptions>(configuration.GetSection(ToolOptions.SectionName));

        services.AddSingleton<ITool, GetWeatherTool>();
        services.AddSingleton<ITool, GetWebsiteTool>();

        services.AddSingleton<IToolRegistry, ToolRegistry>();
        services.AddSingleton<IToolAccessService, ToolAccessService>();
        services.AddSingleton<PendingInteractionRegistry>();
        services.AddSingleton<IToolExecutor, ToolExecutor>();
        services.AddSingleton<IUserTokenProviderFactory, MsalUserTokenProviderFactory>();
        services.AddHttpClient();

        return services;
    }
}
