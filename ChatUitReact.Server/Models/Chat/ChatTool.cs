using System;

namespace ChatUitReact.Server.Models;

public class ChatTool
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public ToolType Type { get; set; } = ToolType.Function;
    public string Schema { get; set; } = string.Empty;  // JSON schema for the tool
    public bool IsRequired { get; set; } = false;
}

public enum ToolType
{
    Function,
    WebSearch,
    CodeInterpreter,
    FileSearch,
    Custom
}
