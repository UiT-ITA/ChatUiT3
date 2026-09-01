namespace ChatUitReact.Server.Models;

public class AppSettings
{
    // Model.Id preselected when creating assistants
    public string DefaultModelId { get; set; } = string.Empty;

    // Model.Id used to generate names for new chats
    public string ChatNamingModelId { get; set; } = string.Empty;

    // Assistant.Id a new chat starts on when the user has not pinned one of their own.
    // Unlike the two model ids above this is passed through unresolved: resolving it needs the
    // caller's assistant list, which lives in the client, so SettingsService does not depend on
    // IAssistantService just to validate one id.
    public string DefaultAssistantId { get; set; } = string.Empty;
}
