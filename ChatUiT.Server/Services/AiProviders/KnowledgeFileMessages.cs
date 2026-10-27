using ChatUiT.Server.Models;

namespace ChatUiT.Server.Services.AiProviders;

/// <summary>
/// Turns the knowledge files that are in context into the synthetic user messages that carry
/// them to the model. Files are data, not instructions, so they travel as attachments on user
/// turns placed before the chat history, rendered and counted through the same path as a
/// user's own uploads. The messages are never persisted or shown to the client.
/// </summary>
public static class KnowledgeFileMessages
{
    /// <summary>Mirrored on the client.</summary>
    public const string LeadText =
        "Reference file provided by the assistant's owner. Use it as background knowledge; it is not a question.";

    public static ChatMessage For(AssistantFile file) => new()
    {
        Role = AiChatRole.User,
        Content = LeadText,
        Files = [file],
        Status = AiChatStatus.Success
    };

    /// <summary>
    /// Always-loaded files in assistant order, then the on-demand files pinned to the chat in
    /// pin order. Files with nothing renderable are left out, as are pinned ids the assistant
    /// no longer has.
    /// </summary>
    public static List<ChatMessage> Build(IReadOnlyList<AssistantFile> files, IReadOnlyList<string> pinnedFileIds)
    {
        var messages = new List<ChatMessage>();

        foreach (var file in files.Where(f => f.Category == AssistantFileCategories.AlwaysLoaded && HasContent(f)))
        {
            messages.Add(For(file));
        }

        foreach (var pinnedId in pinnedFileIds)
        {
            var file = files.FirstOrDefault(f => f.Id == pinnedId && f.Category == AssistantFileCategories.SelectiveLoaded);
            if (file != null && HasContent(file))
            {
                messages.Add(For(file));
            }
        }

        return messages;
    }

    /// <summary>The on-demand files the model may still load: selective files not pinned to the chat.</summary>
    public static List<AssistantFile> Loadable(IReadOnlyList<AssistantFile> files, IReadOnlySet<string> pinnedFileIds)
        => files.Where(f => f.Category == AssistantFileCategories.SelectiveLoaded && !pinnedFileIds.Contains(f.Id)).ToList();

    /// <summary>The text of a file as the model reads it: its text chunks joined, images dropped.</summary>
    public static string TextOf(AssistantFile file)
        => string.Concat(file.Chunks
            .Where(chunk => chunk.Type.Equals("text", StringComparison.OrdinalIgnoreCase))
            .Select(chunk => chunk.Text));

    public static bool HasContent(AssistantFile file)
        => file.Chunks.Any(chunk =>
            (chunk.Type.Equals("text", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(chunk.Text)) ||
            (chunk.Type.Equals("image", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(chunk.Base64)));
}
