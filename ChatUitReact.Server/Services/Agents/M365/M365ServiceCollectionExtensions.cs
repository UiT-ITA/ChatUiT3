using System.Linq;
using Microsoft.Extensions.DependencyInjection;

namespace ChatUitReact.Server.Services.Agents.M365;

public static class M365ServiceCollectionExtensions
{
    public static IServiceCollection AddM365Agents(this IServiceCollection services)
    {
        services.AddSingleton<GraphClient>();

        foreach (var function in M365Functions.Reader.Concat(M365Functions.Writer))
        {
            services.AddSingleton(function);
        }

        services.AddInternalAgent<M365ReaderAgent>();
        services.AddInternalAgentTool<M365ReaderAgent>();
        services.AddInternalAgent<M365WriterAgent>();
        services.AddInternalAgentTool<M365WriterAgent>();

        return services;
    }
}
