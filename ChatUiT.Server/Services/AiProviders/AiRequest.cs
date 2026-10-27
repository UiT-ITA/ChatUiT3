using System.Collections.Generic;

namespace ChatUiT.Server.Services.AiProviders;

using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

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

    /// <summary>The history.</summary>
    public required IReadOnlyList<AiInputItem> Messages { get; init; }

    public required ResolvedChatParameters Parameters { get; init; }

    /// <summary>
    /// The tools the model has from the start of the conversation. Empty when the model cannot
    /// call tools — already gated by the resolver.
    /// </summary>
    public IReadOnlyList<ITool> Tools { get; init; } = new List<ITool>();

    /// <summary>
    /// Tools that become callable once a toolbox load names them: every tool of the toolboxes on
    /// offer, plus every tool a load in the history named. Sorted by id. Claude declares them all
    /// as deferred; the other protocols take only the loaded ones.
    /// </summary>
    public IReadOnlyList<ITool> LoadableTools { get; init; } = new List<ITool>();

    /// <summary>The tools of <see cref="LoadableTools"/> that loads in the history made callable.</summary>
    public IReadOnlyCollection<string> LoadedToolIds { get; init; } = new List<string>();
}
