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
    internal string OwnerId { get; set; } = string.Empty;
}

public class UserAssistantsResult
{
    public List<Assistant> Owned { get; set; } = new();
    public List<Assistant> System { get; set; } = new();
    public List<Assistant> Shared { get; set; } = new();
}
