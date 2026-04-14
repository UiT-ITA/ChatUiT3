using System;
using System.Collections.Generic;

namespace ChatUitReact.Server.Models;

public class ChatFileChunk
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Type { get; set; } = string.Empty;
    public string? Text { get; set; }
    public string? Format { get; set; }
    public string? Base64 { get; set; }
}

public class ChatFile
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string SourceFilename { get; set; } = string.Empty;
    public List<ChatFileChunk> Chunks { get; set; } = new List<ChatFileChunk>();
}