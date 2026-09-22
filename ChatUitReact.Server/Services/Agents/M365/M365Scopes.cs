namespace ChatUitReact.Server.Services.Agents.M365;

/// <summary>Delegated Graph scopes the M365 functions request. All are already consented on the app registration.</summary>
public static class M365Scopes
{
    public const string UserRead = "User.Read";
    public const string UserReadBasicAll = "User.ReadBasic.All";
    public const string PeopleRead = "People.Read";
    public const string PresenceReadAll = "Presence.Read.All";
    public const string CalendarsRead = "Calendars.Read";
    public const string CalendarsReadShared = "Calendars.Read.Shared";
    public const string ChatReadBasic = "Chat.ReadBasic";
    public const string ChatRead = "Chat.Read";
    public const string ChatCreate = "Chat.Create";
    public const string ChatMessageSend = "ChatMessage.Send";
    public const string FilesReadWriteAll = "Files.ReadWrite.All";
}
