using ChatUitReact.Server.Services.Agents.M365.Knowledge;
using ChatUitReact.Server.Services.Knowledge;
using ChatUitReact.Server.Services.Tools;
using Microsoft.Extensions.DependencyInjection;

namespace ChatUitReact.Server.Services.Agents.M365;

public static class M365ServiceCollectionExtensions
{
    public static IServiceCollection AddM365Toolboxes(this IServiceCollection services)
    {
        services.AddSingleton<GraphClient>();

        foreach (var function in M365Toolboxes.FunctionTypes)
        {
            services.AddSingleton(function);
            services.AddSingleton<ITool>(sp => (ITool)sp.GetRequiredService(function));
        }

        foreach (var definition in M365Toolboxes.All)
        {
            services.AddSingleton<IToolbox>(sp => M365Toolboxes.Build(definition, sp));
        }

        services.AddSingleton<IKnowledgeSource, RecentMailKnowledgeSource>();
        services.AddSingleton<IKnowledgeSource, UnreadChatsKnowledgeSource>();
        services.AddSingleton<IKnowledgeSource, TodayScheduleKnowledgeSource>();
        services.AddSingleton<IKnowledgeSource, PlannerTasksKnowledgeSource>();
        services.AddSingleton<IKnowledgeSource, TodoTasksKnowledgeSource>();

        return services;
    }
}
