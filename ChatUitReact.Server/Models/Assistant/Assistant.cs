using System;
using System.Collections.Generic;

namespace ChatUitReact.Server.Models;

public class Assistant
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new List<string>();
    public ChatSettings ChatSettings { get; set; } = new ChatSettings();
    public List<AssistantFile> Files { get; set; } = new List<AssistantFile>();
    internal string OwnerId { get; set; } = string.Empty;
}

public static class AssistantFileCategories
{
    public const string AlwaysLoaded = "alwaysLoaded";
    public const string SelectiveLoaded = "selectiveLoaded";
    public const string RagLoaded = "ragLoaded";
}

public class AssistantFile : ChatFile
{
    public string Category { get; set; } = AssistantFileCategories.AlwaysLoaded;
    public string? Description { get; set; }
}

public class UserAssistantsResult
{
    public List<Assistant> Owned { get; set; } = new();
    public List<Assistant> System { get; set; } = new();
    public List<Assistant> Shared { get; set; } = new();
}
