using ChatUitReact.Server.Services.Agents.M365.Functions;
using Microsoft.Extensions.DependencyInjection;

namespace ChatUitReact.Server.Services.Agents.M365;

public static class M365ServiceCollectionExtensions
{
    public static IServiceCollection AddM365Agents(this IServiceCollection services)
    {
        services.AddSingleton<GraphClient>();

        services.AddSingleton<FindPeopleFunction>();
        services.AddSingleton<GetUserFunction>();
        services.AddSingleton<GetPresenceFunction>();
        services.AddSingleton<GetCalendarViewFunction>();
        services.AddSingleton<GetScheduleFunction>();
        services.AddSingleton<ListChatsFunction>();
        services.AddSingleton<GetChatMessagesFunction>();
        services.AddSingleton<SearchFilesFunction>();
        services.AddSingleton<ReadFileFunction>();
        services.AddSingleton<SendChatMessageFunction>();
        services.AddSingleton<CreateGroupChatFunction>();
        services.AddSingleton<WriteTextFileFunction>();

        services.AddInternalAgent<M365ReaderAgent>();
        services.AddInternalAgentTool<M365ReaderAgent>();
        services.AddInternalAgent<M365WriterAgent>();
        services.AddInternalAgentTool<M365WriterAgent>();

        return services;
    }
}
