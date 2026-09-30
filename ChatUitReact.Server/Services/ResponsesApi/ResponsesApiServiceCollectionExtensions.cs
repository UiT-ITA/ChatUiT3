using Microsoft.Extensions.DependencyInjection;

namespace ChatUitReact.Server.Services.ResponsesApi;

public static class ResponsesApiServiceCollectionExtensions
{
    /// <summary>
    /// Registers the Responses API. Sealing needs Data Protection; its keys must persist across
    /// restarts and be shared by every instance, or sealed items from before are refused.
    /// </summary>
    public static IServiceCollection AddResponsesApi(this IServiceCollection services)
    {
        services.AddSingleton<ItemSealer>();
        services.AddSingleton<ResponsesRequestMapper>();
        services.AddSingleton<ResponsesRunner>();
        return services;
    }
}
