using System;
using ChatUitReact.Server.Services.Agents.M365.Functions;

namespace ChatUitReact.Server.Services.Agents.M365;

/// <summary>The functions each M365 agent exposes, in the order the model sees them. The writer also gets every reader function.</summary>
internal static class M365Functions
{
    public static readonly Type[] Reader =
    [
        // People
        typeof(FindPeopleFunction),
        typeof(GetUserFunction),
        typeof(GetPresenceFunction),

        // Mail
        typeof(ListMailFoldersFunction),
        typeof(SearchMailFunction),
        typeof(GetMailFunction),
        typeof(ReadMailAttachmentFunction),

        // Calendar and meetings
        typeof(GetCalendarViewFunction),
        typeof(GetScheduleFunction),
        typeof(GetEventFunction),
        typeof(FindMeetingTimesFunction),
        typeof(GetMeetingTranscriptFunction),
        typeof(GetMeetingAttendanceFunction),

        // Teams
        typeof(ListChatsFunction),
        typeof(GetChatMessagesFunction),
        typeof(ListTeamsFunction),
        typeof(ListChannelsFunction),
        typeof(GetChannelMessagesFunction),

        // Files and SharePoint
        typeof(SearchFilesFunction),
        typeof(ReadFileFunction),
        typeof(ListFolderFunction),
        typeof(SearchSitesFunction),
        typeof(ListSiteListsFunction),
        typeof(GetListItemsFunction),

        // Tasks
        typeof(ListTodoListsFunction),
        typeof(ListTodoTasksFunction),
        typeof(ListPlannerPlansFunction),
        typeof(ListPlannerBucketsFunction),
        typeof(ListPlannerTasksFunction),

        // OneNote
        typeof(ListOneNoteNotebooksFunction),
        typeof(ListOneNoteSectionsFunction),
        typeof(ListOneNotePagesFunction),
        typeof(ReadOneNotePageFunction)
    ];

    public static readonly Type[] Writer =
    [
        // Mail
        typeof(SendMailFunction),
        typeof(ReplyToMailFunction),
        typeof(CreateMailDraftFunction),
        typeof(UpdateMailFunction),

        // Calendar
        typeof(CreateEventFunction),
        typeof(UpdateEventFunction),
        typeof(CancelEventFunction),
        typeof(RespondToEventFunction),

        // Teams
        typeof(SendChatMessageFunction),
        typeof(CreateGroupChatFunction),
        typeof(SendChannelMessageFunction),

        // Files
        typeof(WriteTextFileFunction),
        typeof(CreateFolderFunction),
        typeof(MoveFileFunction),
        typeof(CopyFileFunction),
        typeof(CreateSharingLinkFunction),

        // Tasks
        typeof(CreateTodoTaskFunction),
        typeof(UpdateTodoTaskFunction),
        typeof(CreatePlannerTaskFunction),
        typeof(UpdatePlannerTaskFunction),

        // OneNote
        typeof(CreateOneNoteSectionFunction),
        typeof(CreateOneNotePageFunction),
        typeof(UpdateOneNotePageFunction)
    ];
}
