namespace ChatUiT.Server.Models;

public class ChatSettings
{
    public string SystemPrompt { get; set; } = string.Empty;
    public LanguageModel Model { get; set; } = new LanguageModel(); // maybe use model id instead?
    public float Temperature { get; set; } = 0.5f;
    public ReasoningEffort ReasoningEffort { get; set; } = ReasoningEffort.None;
    public List<string> AvailableToolIds { get; set; } = new List<string>();
    /// <summary>Ids from <see cref="Services.AiProviders.PromptSnippets"/>, normalized on save.</summary>
    public List<string> PromptSnippets { get; set; } = new List<string>();
}
