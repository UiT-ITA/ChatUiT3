using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ChatUitReact.Server.Services.Tools;

public static class ToolServiceCollectionExtensions
{
    /// <summary>
    /// Registers the tool system. Adding a server tool that is its own toolbox is one line here:
    /// the registries pick up every <see cref="ITool"/> and <see cref="IToolbox"/> in the
    /// container and validate their ids at startup.
    /// </summary>
    public static IServiceCollection AddTools(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<ToolOptions>(configuration.GetSection(ToolOptions.SectionName));

        services.AddSingleToolToolbox<GetWebsiteTool>();

        services.AddSingleton<IToolRegistry, ToolRegistry>();
        services.AddSingleton<IToolboxRegistry, ToolboxRegistry>();
        services.AddSingleton<IToolAccessService, ToolAccessService>();
        services.AddSingleton<PendingInteractionRegistry>();
        services.AddSingleton<IToolExecutor, ToolExecutor>();
        services.AddSingleton<IUserTokenProviderFactory, MsalUserTokenProviderFactory>();
        services.AddHttpClient();

        return services;
    }

    /// <summary>Registers a tool and puts it in the tool registry.</summary>
    public static IServiceCollection AddTool<TTool>(this IServiceCollection services) where TTool : class, ITool
    {
        services.AddSingleton<TTool>();
        services.AddSingleton<ITool>(sp => sp.GetRequiredService<TTool>());
        return services;
    }

    /// <summary>Registers a tool and a toolbox that holds only that tool, under the tool's id.</summary>
    public static IServiceCollection AddSingleToolToolbox<TTool>(this IServiceCollection services) where TTool : class, ITool
    {
        services.AddTool<TTool>();
        services.AddSingleton<IToolbox>(sp => Toolbox.Of(sp.GetRequiredService<TTool>()));
        return services;
    }
}
