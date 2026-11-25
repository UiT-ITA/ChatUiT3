using System.Collections.Generic;
using System.Linq;

namespace ChatUiT.Server.Services.AiProviders;

using ChatUiT.Server.Models;
using ChatUiT.Server.Services.TokenCounting;

/// <summary>
/// Keeps the newest <see cref="MaxImages"/> images of a history: images in tool results and in
/// files attached to messages. Each older image is replaced by <see cref="RemovedText"/>. The
/// history passed in is not changed: changed items are copies.
/// </summary>
public static class ImageLimit
{
    /// <summary>The most images one request carries.</summary>
    public const int MaxImages = 50;

    /// <summary>The text that replaces an image when only the <paramref name="maxImages"/> newest are sent.</summary>
    public static string RemovedText(int maxImages = MaxImages) => $"[Image removed: only the {maxImages} newest images in the conversation are sent]\n";

    public static IReadOnlyList<AiInputItem> KeepNewest(IReadOnlyList<AiInputItem> items, int maxImages = MaxImages)
    {
        if (items.Sum(CountImages) <= maxImages)
        {
            return items;
        }

        var result = new AiInputItem[items.Count];
        var remaining = maxImages;
        for (var i = items.Count - 1; i >= 0; i--)
        {
            result[i] = items[i] switch
            {
                AiInputItem.ToolResult toolResult => KeepNewest(toolResult, ref remaining, maxImages),
                AiInputItem.Message message => KeepNewest(message, ref remaining, maxImages),
                var other => other,
            };
        }

        return result;
    }

    private static int CountImages(AiInputItem item) => item switch
    {
        AiInputItem.ToolResult { Images: { } images } => images.Count,
        AiInputItem.Message message => (message.Value.Files ?? new List<ChatFile>()).Sum(file => file.Chunks.Count(IsImage)),
        _ => 0,
    };

    private static bool IsImage(ChatFileChunk chunk)
        => chunk.IsImage && chunk.Data is { Length: > 0 };

    private static AiInputItem KeepNewest(AiInputItem.ToolResult result, ref int remaining, int maxImages)
    {
        if (result.Images is not { Count: > 0 } images)
        {
            return result;
        }

        var keep = System.Math.Min(images.Count, remaining);
        var removed = images.Count - keep;
        remaining -= keep;
        if (removed == 0)
        {
            return result;
        }

        var keptImages = images.Skip(removed).ToList();
        var removedText = string.Concat(Enumerable.Repeat(RemovedText(maxImages), removed));
        return result with
        {
            Content = $"{result.Content}\n{removedText}",
            Images = keptImages.Count > 0 ? keptImages : null,
        };
    }

    private static AiInputItem KeepNewest(AiInputItem.Message message, ref int remaining, int maxImages)
    {
        var files = message.Value.Files ?? new List<ChatFile>();
        var imageCount = files.Sum(file => file.Chunks.Count(IsImage));
        if (imageCount <= remaining)
        {
            remaining -= imageCount;
            return message;
        }

        // Walks the files and chunks from the last to the first.
        var copies = new List<ChatFile>(files.Count);
        for (var f = files.Count - 1; f >= 0; f--)
        {
            var file = files[f];
            var chunks = new ChatFileChunk[file.Chunks.Count];
            for (var c = file.Chunks.Count - 1; c >= 0; c--)
            {
                var chunk = file.Chunks[c];
                if (IsImage(chunk) && remaining == 0)
                {
                    chunks[c] = new ChatFileChunk { Id = chunk.Id, Type = "text", Text = RemovedText(maxImages) };
                    continue;
                }

                if (IsImage(chunk))
                {
                    remaining--;
                }

                chunks[c] = chunk;
            }

            copies.Insert(0, new ChatFile
            {
                Id = file.Id,
                SourceFilename = file.SourceFilename,
                Size = file.Size,
                ContentType = file.ContentType,
                IsEncrypted = file.IsEncrypted,
                Chunks = chunks.ToList()
            });
        }

        var copy = new ChatMessage
        {
            Id = message.Value.Id,
            Role = message.Value.Role,
            Timestamp = message.Value.Timestamp,
            Content = message.Value.Content,
            Status = message.Value.Status,
            Files = copies,
            AssistantId = message.Value.AssistantId,
            AssistantName = message.Value.AssistantName,
            Activity = message.Value.Activity,
            Transcript = message.Value.Transcript,
            TokenCounts = message.Value.TokenCounts,
            FileTokenCounts = message.Value.FileTokenCounts,
        };
        return new AiInputItem.Message(copy);
    }
}
