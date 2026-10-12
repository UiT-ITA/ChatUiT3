namespace ChatUitReact.Server.Services.Agents.M365;

/// <summary>Delegated Graph scopes the M365 functions request. All are already consented on the app registration.</summary>
public static class M365Scopes
{
    public const string UserRead = "User.Read";
    public const string UserReadBasicAll = "User.ReadBasic.All";
    public const string PeopleRead = "People.Read";
    public const string ContactsRead = "Contacts.Read";
    public const string PresenceReadAll = "Presence.Read.All";
    public const string CalendarsRead = "Calendars.Read";
    public const string CalendarsReadShared = "Calendars.Read.Shared";
    public const string CalendarsReadWrite = "Calendars.ReadWrite";
    public const string ChatReadBasic = "Chat.ReadBasic";
    public const string ChatRead = "Chat.Read";
    public const string ChatCreate = "Chat.Create";
    public const string ChatMessageSend = "ChatMessage.Send";
    public const string TeamReadBasicAll = "Team.ReadBasic.All";
    public const string ChannelReadBasicAll = "Channel.ReadBasic.All";
    public const string ChannelMessageReadAll = "ChannelMessage.Read.All";
    public const string ChannelMessageSend = "ChannelMessage.Send";
    public const string FilesReadWriteAll = "Files.ReadWrite.All";
    public const string SitesReadAll = "Sites.Read.All";
    public const string MailRead = "Mail.Read";
    public const string MailReadShared = "Mail.Read.Shared";
    public const string MailReadWrite = "Mail.ReadWrite";
    public const string MailSend = "Mail.Send";
    public const string OnlineMeetingsRead = "OnlineMeetings.Read";
    public const string OnlineMeetingTranscriptReadAll = "OnlineMeetingTranscript.Read.All";
    public const string OnlineMeetingArtifactReadAll = "OnlineMeetingArtifact.Read.All";

    /// <summary>Also used by the To Do and Planner readers: Tasks.Read is not granted.</summary>
    public const string TasksReadWrite = "Tasks.ReadWrite";
    public const string NotesReadAll = "Notes.Read.All";
    public const string NotesReadWriteAll = "Notes.ReadWrite.All";
}
