namespace ChatUitReact.Server.Models;

public class CompletionRequest
{
    public string Prompt { get; set; } = string.Empty;
    public float Temperature { get; set; } = 0.5f;
    public int MaxTokens { get; set; } = 32_768;
    public ThinkingLevel Thinking { get; set; } = ThinkingLevel.Medium;
    public string? SystemPrompt { get; set; }
}

public enum ThinkingLevel
{
    Low,
    Medium,
    High
}
