namespace ChatUitReact.Server.Models;

public class AiChat
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public AiAssistant Assistant { get; set; } = new AiAssistant();
    public AiModelSettings CurrentSettings { get; set; } = new AiModelSettings();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    // Get the last updated time from the messages
    public DateTime UpdatedAt { 
        get {
            if (Messages.Count == 0)
                return CreatedAt;
            return Messages.Max(m => m.Timestamp); 
        } 
    }
    public List<AiChatMessage> Messages { get; set; } = new List<AiChatMessage>();
    public List<AiChatFile> Files { get; set; } = new List<AiChatFile>();
}

public class AiChatMessage
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public AiChatRole Role { get; set; } = AiChatRole.User;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string Content { get; set; } = string.Empty;
    public List<string> FileIds { get; set; } = new List<string>();
}

public class AiChatFile
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; } = 0;
    public string StoragePath { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public bool IsProcessed { get; set; } = false;
    public string ProcessingStatus { get; set; } = string.Empty;
}

public enum AiChatRole
{
    User,
    Assistant,
    System
}