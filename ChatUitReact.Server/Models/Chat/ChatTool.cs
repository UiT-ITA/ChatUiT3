using System;
using System.Text.Json;

namespace ChatUitReact.Server.Models;

public abstract class ChatTool
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public abstract string Name { get; }
    public abstract string Description { get; }
    public abstract string FunctionName { get; }
    public abstract List<ChatToolParameter> Parameters { get; }
    public abstract List<string> RequiredParameters { get; }

    public abstract Task<string> ExecuteAsync(JsonElement args, ToolContext ctx, CancellationToken ct);
}

public class ChatToolParameter
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string[]? Enum { get; set; } = null;
    public string Description { get; set; } = string.Empty;
}

public class ToolContext
{
    public string UserId { get; set; } = string.Empty;
    public string ChatId { get; set; } = string.Empty;
    public string ToolCallId { get; set; } = string.Empty;
    // public IDictionary<string, object> Metadata { get; set; } = new Dictionary<string, object>();
}
