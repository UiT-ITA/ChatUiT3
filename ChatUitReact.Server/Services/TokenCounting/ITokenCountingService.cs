using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services.TokenCounting;

/// <summary>
/// Counts what a request costs in the context window, per counting scheme. The server holds
/// every byte that goes to the provider, so this is where counting lives; the client only
/// counts the draft that has not been sent yet.
/// </summary>
public interface ITokenCountingService
{
    /// <summary>Distinct, parseable scheme ids across every model currently registered.</summary>
    Task<IReadOnlyList<string>> GetActiveSchemeIdsAsync();

    int CountText(string text, string schemeId);

    int CountImage(int width, int height, string schemeId);

    /// <summary>Everything the provider would send for this message, framing included.</summary>
    int CountMessage(ChatMessage message, string schemeId);

    /// <summary>Tokens for every scheme in <paramref name="schemeIds"/>.</summary>
    Dictionary<string, int> CountMessage(ChatMessage message, IReadOnlyList<string> schemeIds);

    /// <summary>
    /// The fixed cost of every request made through an assistant: system prompt (knowledge
    /// files already appended), tool definitions, and reply priming.
    /// </summary>
    int CountSystemPrompt(string systemPrompt, IReadOnlyList<ChatTool> tools, string schemeId);

    /// <summary>
    /// Adds counts for schemes the message lacks. Returns true when anything was added.
    /// Message files must carry their content.
    /// </summary>
    bool FillMissingMessageCounts(ChatMessage message, IReadOnlyList<string> schemeIds);
}
