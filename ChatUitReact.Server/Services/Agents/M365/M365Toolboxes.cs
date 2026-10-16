using System;
using System.Collections.Generic;
using System.Linq;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Agents.M365.Functions;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365;

/// <summary>
/// The Microsoft 365 toolboxes, in the order the model sees their functions. Read and write are
/// separate toolboxes, and write toolboxes default to admins. The write toolboxes that address
/// people also hold find_people.
///
/// Assistants saved with the former agent tools map onto these: m365_reader onto every read
/// toolbox, m365_writer onto every read and write toolbox.
/// </summary>
internal static class M365Toolboxes
{
    private const string ReaderLegacyId = "m365_reader";
    private const string WriterLegacyId = "m365_writer";

    internal sealed record Definition(
        string Id,
        string DisplayName,
        string Description,
        bool Writes,
        Type[] Functions);

    public static readonly Definition[] All =
    [
        new("m365_people", "People", "Look up people in the organisation and the user's contacts, user profiles and Teams presence.", false,
        [
            typeof(FindPeopleFunction),
            typeof(GetUserFunction),
            typeof(GetPresenceFunction)
        ]),

        new("outlook_mail_read", "Outlook mail (read)", "Search and read the user's email, mail folders and text attachments.", false,
        [
            typeof(ListMailFoldersFunction),
            typeof(SearchMailFunction),
            typeof(GetMailFunction),
            typeof(ReadMailAttachmentFunction)
        ]),

        new("outlook_mail_write", "Outlook mail (write)", "Send, reply to, forward and draft email, and move, flag or mark email. Load outlook_mail_read with it to find the email to act on.", true,
        [
            typeof(FindPeopleFunction),
            typeof(SendMailFunction),
            typeof(ReplyToMailFunction),
            typeof(CreateMailDraftFunction),
            typeof(UpdateMailFunction)
        ]),

        new("outlook_calendar_read", "Outlook calendar (read)", "Read calendars and events, free/busy for several people, suggested meeting times, and Teams meeting transcripts and attendance.", false,
        [
            typeof(GetCalendarViewFunction),
            typeof(GetScheduleFunction),
            typeof(GetEventFunction),
            typeof(FindMeetingTimesFunction),
            typeof(GetMeetingTranscriptFunction),
            typeof(GetMeetingAttendanceFunction)
        ]),

        new("outlook_calendar_write", "Outlook calendar (write)", "Create, change and cancel calendar events and answer meeting invitations. Load outlook_calendar_read with it to find events and free time.", true,
        [
            typeof(FindPeopleFunction),
            typeof(CreateEventFunction),
            typeof(UpdateEventFunction),
            typeof(CancelEventFunction),
            typeof(RespondToEventFunction)
        ]),

        new("teams_read", "Teams (read)", "List and read the user's Teams chats, teams, channels and channel posts.", false,
        [
            typeof(ListChatsFunction),
            typeof(GetChatMessagesFunction),
            typeof(ListTeamsFunction),
            typeof(ListChannelsFunction),
            typeof(GetChannelMessagesFunction)
        ]),

        new("teams_write", "Teams (write)", "Send Teams chat messages, create group chats and post in channels. Load teams_read with it to find chat, team and channel ids.", true,
        [
            typeof(FindPeopleFunction),
            typeof(SendChatMessageFunction),
            typeof(CreateGroupChatFunction),
            typeof(SendChannelMessageFunction)
        ]),

        new("files_read", "Files (read)", "Search, list and read files in OneDrive and SharePoint, SharePoint sites, lists and list items.", false,
        [
            typeof(SearchFilesFunction),
            typeof(ReadFileFunction),
            typeof(ListFolderFunction),
            typeof(SearchSitesFunction),
            typeof(ListSiteListsFunction),
            typeof(GetListItemsFunction)
        ]),

        new("files_write", "Files (write)", "Write text files, create folders, move, rename, copy and share files in OneDrive and SharePoint. Load files_read with it to find the files to act on.", true,
        [
            typeof(FindPeopleFunction),
            typeof(WriteTextFileFunction),
            typeof(CreateFolderFunction),
            typeof(MoveFileFunction),
            typeof(CopyFileFunction),
            typeof(CreateSharingLinkFunction)
        ]),

        new("tasks_read", "Tasks (read)", "Read Microsoft To Do lists and tasks, and Planner plans, buckets and tasks.", false,
        [
            typeof(ListTodoListsFunction),
            typeof(ListTodoTasksFunction),
            typeof(ListPlannerPlansFunction),
            typeof(ListPlannerBucketsFunction),
            typeof(ListPlannerTasksFunction)
        ]),

        new("tasks_write", "Tasks (write)", "Create, change and complete To Do and Planner tasks. Load tasks_read with it to find lists, plans and tasks.", true,
        [
            typeof(FindPeopleFunction),
            typeof(CreateTodoTaskFunction),
            typeof(UpdateTodoTaskFunction),
            typeof(CreatePlannerTaskFunction),
            typeof(UpdatePlannerTaskFunction)
        ]),

        new("onenote_read", "OneNote (read)", "List OneNote notebooks, sections and pages, and read pages.", false,
        [
            typeof(ListOneNoteNotebooksFunction),
            typeof(ListOneNoteSectionsFunction),
            typeof(ListOneNotePagesFunction),
            typeof(ReadOneNotePageFunction)
        ]),

        new("onenote_write", "OneNote (write)", "Create OneNote sections and pages and edit pages. Load onenote_read with it to find notebooks, sections and pages.", true,
        [
            typeof(CreateOneNoteSectionFunction),
            typeof(CreateOneNotePageFunction),
            typeof(UpdateOneNotePageFunction)
        ])
    ];

    /// <summary>Every function type, each once.</summary>
    public static IEnumerable<Type> FunctionTypes => All.SelectMany(d => d.Functions).Distinct();

    /// <summary>The functions of the read toolboxes, in toolbox order.</summary>
    public static IEnumerable<Type> ReadFunctionTypes => All.Where(d => !d.Writes).SelectMany(d => d.Functions).Distinct();

    public static IToolbox Build(Definition definition, IServiceProvider services) => new Toolbox
    {
        Id = definition.Id,
        DisplayName = definition.DisplayName,
        Description = definition.Description,
        DefaultPolicy = definition.Writes ? ToolAccessPolicy.ForRoles(UserRole.Admin) : ToolAccessPolicy.Everyone,
        Tools = definition.Functions.Select(t => (ITool)services.GetService(t)!).ToList(),
        LegacyIds = definition.Writes ? [WriterLegacyId] : [ReaderLegacyId, WriterLegacyId]
    };
}
