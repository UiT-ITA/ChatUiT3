using System;
using System.Collections.Generic;
using System.Linq;

namespace ChatUiT.Server.Services.AiProviders;

using ChatUiT.Server.Models;
using ChatUiT.Server.Services.TokenCounting;

/// <summary>Turns stored chat messages into request history, replaying each assistant message's transcript.</summary>
public static class TranscriptReplay
{
    /// <summary>What an unanswered call gets on replay, so every call in the history has a result.</summary>
    public const string NoResultText = "No result: the generation ended before this call finished.";

    /// <summary>
    /// Each message as history: an assistant message with a transcript as the items it records,
    /// every other message as itself. A call the transcript has no result for (the run failed or
    /// hit the round limit) gets <see cref="NoResultText"/>.
    /// </summary>
    public static List<AiInputItem> ToInputItems(IEnumerable<ChatMessage> messages)
    {
        var items = new List<AiInputItem>();
        foreach (var message in messages)
        {
            if (message.Role == AiChatRole.Assistant && message.Transcript is { Count: > 0 } transcript)
            {
                AddTranscript(items, message, transcript);
            }
            else
            {
                items.Add(new AiInputItem.Message(message));
            }
        }

        return items;
    }

    /// <summary>The tools toolbox loads in these messages made callable.</summary>
    public static IReadOnlyCollection<string> LoadedToolIds(IEnumerable<ChatMessage> messages)
        => messages
            .Where(m => m.Transcript != null)
            .SelectMany(m => m.Transcript!)
            .Where(item => item.Kind == TranscriptItemKind.ToolResult)
            .SelectMany(item => item.LoadedToolIds ?? [])
            .ToHashSet(StringComparer.Ordinal);

    private static void AddTranscript(List<AiInputItem> items, ChatMessage message, List<TranscriptItem> transcript)
    {
        var unanswered = new List<string>();

        foreach (var item in transcript)
        {
            switch (item.Kind)
            {
                case TranscriptItemKind.Reasoning when item.Protocol is { } protocol && item.Payload is { } payload:
                    CloseUnanswered();
                    items.Add(new AiInputItem.ReasoningState(protocol, item.ModelId ?? string.Empty, payload));
                    break;
                case TranscriptItemKind.Text when !string.IsNullOrEmpty(item.Text):
                    CloseUnanswered();
                    items.Add(new AiInputItem.Message(new ChatMessage
                    {
                        Id = message.Id,
                        Role = AiChatRole.Assistant,
                        Timestamp = message.Timestamp,
                        Content = item.Text,
                        Status = message.Status,
                        AssistantId = message.AssistantId,
                        AssistantName = message.AssistantName
                    }));
                    break;
                case TranscriptItemKind.ToolCall when item.ToolCallId != null && item.Name != null:
                    items.Add(new AiInputItem.ToolCall(item.ToolCallId, item.Name, string.IsNullOrWhiteSpace(item.ArgumentsJson) ? "{}" : item.ArgumentsJson));
                    unanswered.Add(item.ToolCallId);
                    break;
                case TranscriptItemKind.ToolResult when item.ToolCallId != null:
                    items.Add(new AiInputItem.ToolResult(item.ToolCallId, item.Content ?? string.Empty, item.IsError, item.Images?.Select(i => new ImagePart(i.Base64, i.MediaType)).ToList(), item.LoadedToolIds));
                    unanswered.Remove(item.ToolCallId);
                    break;
            }
        }

        CloseUnanswered();

        void CloseUnanswered()
        {
            foreach (var id in unanswered)
            {
                items.Add(new AiInputItem.ToolResult(id, NoResultText, IsError: true));
            }

            unanswered.Clear();
        }
    }
}
