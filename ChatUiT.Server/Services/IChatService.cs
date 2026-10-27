using System.Security.Claims;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.AiProviders;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services;

public interface IChatService
{    
    // Chat Management
    Task<List<ChatHeader>> GetChatListAsync(string userId);
    /// <summary>The chat without its messages.</summary>
    Task<ChatHeader?> GetChatHeaderAsync(string userId, string chatId);
    Task<Chat?> GetChatByIdAsync(string userId, string chatId, bool includeFileContent = true);
    Task<ChatFile?> GetChatFileAsync(string userId, string chatId, string fileId);
    Task<Chat> CreateChatAsync(string userId, string assistantId, bool redEnabled = false);
    Task UpdateChatAsync(string userId, string chatId, string? newTitle, string? newAssistantId = null);
    Task SetChatFavoriteAsync(string userId, string chatId, bool isFavorite);
    /// <summary>Allows red data in the chat, and switches it to <paramref name="assistantId"/> when given.</summary>
    Task EnableRedAsync(string userId, string chatId, string? assistantId);
    Task DeleteChatAsync(string userId, string chatId);
    
    // Message Operations
    Task SendMessageAsync(string userId, string chatId, ChatMessage message, PromptUserContext promptUser);
    Task SendMessageAsync(string userId, string chatId, ChatMessage message, string? assistantId, PromptUserContext promptUser);
    Task SendStreamingMessageAsync(string userId, string chatId, ChatMessage message, PromptUserContext promptUser);
    Task SendStreamingMessageAsync(string userId, string chatId, ChatMessage message, string assistantId, PromptUserContext promptUser);
    Task SendStreamingMessageAsync(string userId, string chatId, ChatMessage message, string? assistantId, PromptUserContext promptUser, ToolSessionInput tools);
    Task AddMessageAsync(string userId, string chatId, ChatMessage message);
    Task DeleteMessageAsync(string userId, string chatId, string messageId);

    /// <summary>
    /// Stops a running generation and undoes the send. False when no generation was running.
    /// </summary>
    Task<bool> CancelGenerationAsync(string userId, string chatId, string messageId);

    /// <summary>Answers a tool call that is waiting for the user or the client.</summary>
    Task<ToolCallResponseResultDto> RespondToToolCallAsync(string userId, string chatId, string messageId, string toolCallId, ToolCallResponseDto response);

    // AI Response
    Task<string> GetResponseAsync(string userId, string chatId, ChatMessage userMessage);
    Task<string> GetResponseAsync(string userId, string chatId);

    // AI Response without chat
    Task<string> GetResponseAsync(string userId, ChatSettings settings, List<ChatMessage> messages);

    // Streaming AI Response
    // Response is a stream of strings, which can be concatenated to form the full response.
    Task<string> GetStreamingResponseAsync(string userId, string chatId, ChatMessage userMessage);
    Task<string> GetStreamingResponseAsync(string userId, string chatId);

    // Streaming AI Response without chat
    Task<string> GetStreamingResponseAsync(string userId, ChatSettings settings, List<ChatMessage> messages);
}
