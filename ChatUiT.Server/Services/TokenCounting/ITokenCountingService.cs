using ChatUiT.Server.Services.Tools;
using ChatUiT.Server.Models;

namespace ChatUiT.Server.Services.TokenCounting;

/// <summary>
/// Counts what a request costs in the context window, per counting scheme. The server holds
/// every byte that goes to the provider, so this is where counting lives; the client only
/// counts the draft that has not been sent yet.
/// </summary>
/// <summary>
/// Per scheme: the whole message, and the part of it spent on attachments. Files is empty
/// for a message without files.
/// </summary>
public sealed record MessageTokenCounts(Dictionary<string, int> Total, Dictionary<string, int> Files);

public interface ITokenCountingService
{
    /// <summary>Distinct, parseable scheme ids across every model currently registered.</summary>
    Task<IReadOnlyList<string>> GetActiveSchemeIdsAsync();

    int CountText(string text, string schemeId);

    int CountImage(int width, int height, string schemeId);

    /// <summary>Everything the provider would send for this message, framing included.</summary>
    int CountMessage(ChatMessage message, string schemeId);

    /// <summary>
    /// Tokens for every scheme in <paramref name="schemeIds"/>, with the attachment share. For a
    /// scheme every file has a stored count for, the files are priced from those counts.
    /// Otherwise the files must carry their content.
    /// </summary>
    MessageTokenCounts CountMessage(ChatMessage message, IReadOnlyList<string> schemeIds);

    /// <summary>Per scheme: what the file adds to the message that carries it. The file must carry its content.</summary>
    Dictionary<string, int> CountFile(ChatFile file, IReadOnlyList<string> schemeIds);

    /// <summary>
    /// The fixed cost of every request made through an assistant: system prompt (knowledge
    /// files already appended), tool definitions, and reply priming.
    /// </summary>
    int CountSystemPrompt(string systemPrompt, IReadOnlyList<ITool> tools, string schemeId);

    /// <summary>
    /// Adds counts for schemes the message lacks in either map (the attachment map only
    /// matters for messages with files). Returns true when anything was added. A scheme is
    /// left out while a file has neither a stored count for it nor its content loaded.
    /// </summary>
    bool FillMissingMessageCounts(ChatMessage message, IReadOnlyList<string> schemeIds);
}
