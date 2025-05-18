namespace ChatUitReact.Server.Models;

public class AiChatHeader
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public AiChatStatus Status { get; set; } = AiChatStatus.Success;
}

public class AiChat : AiChatHeader
{
    new public DateTime CreatedAt
    {
        get
        {
            if (Messages.Count == 0)
                return DateTime.UtcNow;
            return Messages.Min(m => m.Timestamp);
        }
    }
    new public DateTime UpdatedAt
    {
        get
        {
            if (Messages.Count == 0)
                return CreatedAt;
            return Messages.Max(m => m.Timestamp);
        }
    }
    public AiChatSettings Settings { get; set; } = new AiChatSettings();
    public List<AiChatMessage> Messages { get; set; } = new List<AiChatMessage>();
}

public class AiChatMessage
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public AiChatRole Role { get; set; } = AiChatRole.User;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string Content { get; set; } = string.Empty;
    public AiChatStatus Status { get; set; } = AiChatStatus.Success;

    // Will be added later for file support
    //public List<AiChatFile> Files { get; set; } = new List<AiChatFile>();
}

public class AiChatSettings
{
    public string AssistantName { get; set; } = string.Empty;
    public string SystemPrompt { get; set; } = string.Empty;
    public AiModelSettings ModelSettings { get; set; } = new AiModelSettings();
    public bool SaveToDB { get; set; } = true;
}

public abstract class AiChatFile
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string? Filename { get; set; } = string.Empty;
    public abstract AiContentType Type { get; }
}

public class AiChatFileText : AiChatFile
{
    public override AiContentType Type { get; } = AiContentType.Text;
    public string Content { get; set; } = string.Empty;
}

public class AiChatFileImage : AiChatFile
{
    public override AiContentType Type { get; } = AiContentType.Image;
    public string Content { get; set; } = string.Empty;
}

public class AiChatFileMixed : AiChatFile
{
    public override AiContentType Type { get; } = AiContentType.Mixed;
    public List<AiChatFile> Chunks { get; set; } = new List<AiChatFile>();
}


public enum AiChatRole
{
    User,
    Assistant,
    System,
    ToolRequest,
    ToolResponse,
}
public enum AiContentType
{
    Text,
    Image,
    Mixed
}
public enum AiChatStatus
{
    New,
    Generating,
    Success,
    Error,
    Cancelled,
}
