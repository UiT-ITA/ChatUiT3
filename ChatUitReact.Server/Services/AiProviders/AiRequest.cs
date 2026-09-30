using System.Collections.Generic;

namespace ChatUitReact.Server.Services.AiProviders;

using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

/// <summary>
/// One chat request, expressed in terms every provider understands.
///
/// The system prompt is a separate field rather than a message because providers disagree
/// about where it goes — OpenAI takes a leading system message, Anthropic a top-level
/// parameter. Tools are the neutral <see cref="ITool"/>, so no provider's SDK type
/// leaks across the seam.
/// </summary>
public sealed record AiRequest
{
    public required Model Model { get; init; }

    public required ModelEndpoint Endpoint { get; init; }

    public string SystemPrompt { get; init; } = string.Empty;

    /// <summary>The history. Chats send only <see cref="AiInputItem.Message"/>.</summary>
    public required IReadOnlyList<AiInputItem> Messages { get; init; }

    public required ResolvedChatParameters Parameters { get; init; }

    /// <summary>Empty when the model cannot call tools — already gated by the resolver.</summary>
    public IReadOnlyList<ITool> Tools { get; init; } = new List<ITool>();
}
