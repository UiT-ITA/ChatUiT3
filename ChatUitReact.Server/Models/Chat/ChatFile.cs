using System;
using System.Collections.Generic;

namespace ChatUitReact.Server.Models;

public abstract class ChatFile
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string? Filename { get; set; } = string.Empty;
    public abstract AiContentType Type { get; }
}

public class ChatFileText : ChatFile
{
    public override AiContentType Type { get; } = AiContentType.Text;
    public string Content { get; set; } = string.Empty;
}

public class ChatFileImage : ChatFile
{
    public override AiContentType Type { get; } = AiContentType.Image;
    public string Content { get; set; } = string.Empty;
}

public class ChatFileMixed : ChatFile
{
    public override AiContentType Type { get; } = AiContentType.Mixed;
    public List<ChatFile> Chunks { get; set; } = new List<ChatFile>();
}
