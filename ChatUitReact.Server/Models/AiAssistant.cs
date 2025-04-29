namespace ChatUitReact.Server.Models;

public class AiAssistant
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public AiModel Model { get; set; } = new AiModel();
    public string SystemPrompt { get; set; } = string.Empty;
    public AiModelSettings ModelSettings { get; set; } = new AiModelSettings();
    public List<AiChatTool> Tools { get; set; } = new List<AiChatTool>();
    public string OwnerId { get; set; } = string.Empty;
    public bool IsSystemCreated { get; set; } = false;
    public List<string> SharedWithUserIds { get; set; } = new List<string>();
    public List<string> PreloadedDocumentIds { get; set; } = new List<string>();
}