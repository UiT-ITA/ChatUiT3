using Microsoft.Extensions.DependencyInjection;

namespace ChatUitReact.Server.Services.Knowledge;

public static class KnowledgeSourceServiceCollectionExtensions
{
    /// <summary>
    /// Registers the knowledge source registry. Sources register themselves as
    /// <see cref="IKnowledgeSource"/>; the registry validates their ids at startup.
    /// </summary>
    public static IServiceCollection AddKnowledgeSources(this IServiceCollection services)
    {
        services.AddSingleton<IKnowledgeSourceRegistry, KnowledgeSourceRegistry>();
        return services;
    }
}
