using System.Collections.Generic;
using ChatUitReact.Server.Services.Agents.M365.Functions;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365;

/// <summary>Read-only Microsoft 365 agent: people, presence, calendars, Teams chats and files.</summary>
public sealed class M365ReaderAgent : InternalAgent
{
    public M365ReaderAgent(
        FindPeopleFunction findPeople,
        GetUserFunction getUser,
        GetPresenceFunction getPresence,
        GetCalendarViewFunction getCalendarView,
        GetScheduleFunction getSchedule,
        ListChatsFunction listChats,
        GetChatMessagesFunction getChatMessages,
        SearchFilesFunction searchFiles,
        ReadFileFunction readFile)
    {
        Functions = [findPeople, getUser, getPresence, getCalendarView, getSchedule, listChats, getChatMessages, searchFiles, readFile];
    }

    public override string Id => "m365_reader";

    public override string DisplayName => "Microsoft 365 (read)";

    public override string Description => "Reads the user's Microsoft 365: people, presence, calendars and free/busy, Teams chats, and files.";

    public override string SystemPrompt => M365Prompts.Reader;

    public override IReadOnlyList<ITool> Functions { get; }
}
