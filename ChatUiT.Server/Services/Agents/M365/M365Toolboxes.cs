using System;
using System.Collections.Generic;
using System.Linq;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Agents.M365.Functions;
using ChatUiT.Server.Services.Tools;
using Microsoft.Extensions.DependencyInjection;

namespace ChatUiT.Server.Services.Agents.M365;

/// <summary>
/// The Microsoft 365 toolboxes. Each one reads, and each one that can write has a Write child
/// toolbox with the write functions, which defaults to admins. The write functions that address
/// people come with find_people.
/// </summary>
internal static class M365Toolboxes
{
    internal sealed record Definition(
        string Id,
        string DisplayName,
        string Description,
        Type[] ReadFunctions,
        Type[] WriteFunctions);

    public static readonly Definition[] All =
    [
        new("m365_people", "People", "Look up people in the organisation and the user's contacts, user profiles and Teams presence.",
        [
            typeof(FindPeopleFunction),
            typeof(GetUserFunction),
            typeof(GetPresenceFunction)
        ],
        []),

        new("outlook_mail", "Outlook mail", "Search and read the user's email, mail folders and text attachments.",
        [
            typeof(ListMailFoldersFunction),
            typeof(SearchMailFunction),
            typeof(GetMailFunction),
            typeof(ReadMailAttachmentFunction)
        ],
        [
            typeof(FindPeopleFunction),
            typeof(SendMailFunction),
            typeof(ReplyToMailFunction),
            typeof(CreateMailDraftFunction),
            typeof(UpdateMailFunction)
        ]),

        new("outlook_calendar", "Outlook calendar", "Read calendars and events, free/busy for several people, suggested meeting times, and Teams meeting transcripts and attendance.",
        [
            typeof(GetCalendarViewFunction),
            typeof(GetScheduleFunction),
            typeof(GetEventFunction),
            typeof(FindMeetingTimesFunction),
            typeof(GetMeetingTranscriptFunction),
            typeof(GetMeetingAttendanceFunction)
        ],
        [
            typeof(FindPeopleFunction),
            typeof(CreateEventFunction),
            typeof(UpdateEventFunction),
            typeof(CancelEventFunction),
            typeof(RespondToEventFunction)
        ]),

        new("teams", "Teams", "List and read the user's Teams chats, teams, channels and channel posts.",
        [
            typeof(ListChatsFunction),
            typeof(GetChatMessagesFunction),
            typeof(ListTeamsFunction),
            typeof(ListChannelsFunction),
            typeof(GetChannelMessagesFunction)
        ],
        [
            typeof(FindPeopleFunction),
            typeof(SendChatMessageFunction),
            typeof(CreateGroupChatFunction),
            typeof(SendChannelMessageFunction)
        ]),

        new("files", "Files", "Search, list and read files in OneDrive and SharePoint, SharePoint sites, lists and list items.",
        [
            typeof(SearchFilesFunction),
            typeof(ReadFileFunction),
            typeof(ListFolderFunction),
            typeof(SearchSitesFunction),
            typeof(ListSiteListsFunction),
            typeof(GetListItemsFunction)
        ],
        [
            typeof(FindPeopleFunction),
            typeof(WriteTextFileFunction),
            typeof(CreateFolderFunction),
            typeof(MoveFileFunction),
            typeof(CopyFileFunction),
            typeof(CreateSharingLinkFunction)
        ]),

        new("tasks", "Tasks", "Read Microsoft To Do lists and tasks, and Planner plans, buckets and tasks.",
        [
            typeof(ListTodoListsFunction),
            typeof(ListTodoTasksFunction),
            typeof(ListPlannerPlansFunction),
            typeof(ListPlannerBucketsFunction),
            typeof(ListPlannerTasksFunction)
        ],
        [
            typeof(FindPeopleFunction),
            typeof(CreateTodoTaskFunction),
            typeof(UpdateTodoTaskFunction),
            typeof(CreatePlannerTaskFunction),
            typeof(UpdatePlannerTaskFunction)
        ]),

        new("onenote", "OneNote", "List OneNote notebooks, sections and pages, and read pages.",
        [
            typeof(ListOneNoteNotebooksFunction),
            typeof(ListOneNoteSectionsFunction),
            typeof(ListOneNotePagesFunction),
            typeof(ReadOneNotePageFunction)
        ],
        [
            typeof(CreateOneNoteSectionFunction),
            typeof(CreateOneNotePageFunction),
            typeof(UpdateOneNotePageFunction)
        ])
    ];

    /// <summary>Every function type, each once.</summary>
    public static IEnumerable<Type> FunctionTypes => All.SelectMany(d => d.ReadFunctions.Concat(d.WriteFunctions)).Distinct();

    /// <summary>The read functions, in toolbox order.</summary>
    public static IEnumerable<Type> ReadFunctionTypes => All.SelectMany(d => d.ReadFunctions).Distinct();

    public static IToolbox Build(Definition definition, IServiceProvider services) => new Toolbox
    {
        Id = definition.Id,
        DisplayName = definition.DisplayName,
        Description = definition.Description,
        Tools = Resolve(definition.ReadFunctions, services),
        Children = definition.WriteFunctions.Length == 0 ? [] :
        [
            new Toolbox
            {
                Id = $"{definition.Id}_write",
                DisplayName = "Write",
                Description = "Allows the agent to perform write operations.",
                DefaultPolicy = ToolAccessPolicy.ForRoles(UserRole.Admin),
                Tools = Resolve(definition.WriteFunctions, services)
            }
        ]
    };

    private static List<ITool> Resolve(Type[] functions, IServiceProvider services)
        => functions.Select(t => (ITool)services.GetRequiredService(t)).ToList();
}
