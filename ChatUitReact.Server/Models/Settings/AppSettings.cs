namespace ChatUitReact.Server.Models;

public class AppSettings
{
    // Model.Id preselected when creating assistants
    public string DefaultModelId { get; set; } = string.Empty;

    // Model.Id used to generate names for new chats
    public string ChatNamingModelId { get; set; } = string.Empty;
}
