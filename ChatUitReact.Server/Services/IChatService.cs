using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.AiProviders;

namespace ChatUitReact.Server.Services;

public interface IChatService
{    
    // Chat Management
    Task<List<ChatHeader>> GetChatListAsync(string userId);
    Task<Chat?> GetChatByIdAsync(string userId, string chatId, bool includeFileContent = true);
    Task<ChatFile?> GetChatFileAsync(string userId, string chatId, string fileId);
    Task<Chat> CreateChatAsync(string userId, string assistantId, List<ChatMessage> messages, PromptUserContext promptUser);
    Task UpdateChatAsync(string userId, string chatId, string? newTitle, string? newAssistantId = null);
    Task SetChatFavoriteAsync(string userId, string chatId, bool isFavorite);
    Task DeleteChatAsync(string userId, string chatId);
    
    // Message Operations
    Task SendMessageAsync(string userId, string chatId, ChatMessage message, PromptUserContext promptUser);
    Task SendMessageAsync(string userId, string chatId, ChatMessage message, string? assistantId, PromptUserContext promptUser);
    Task SendStreamingMessageAsync(string userId, string chatId, ChatMessage message, PromptUserContext promptUser);
    Task SendStreamingMessageAsync(string userId, string chatId, ChatMessage message, string assistantId, PromptUserContext promptUser);
    Task AddMessageAsync(string userId, string chatId, ChatMessage message);
    Task DeleteMessageAsync(string userId, string chatId, string messageId);

    /// <summary>
    /// Stops a running generation and undoes the send. False when no generation was running.
    /// </summary>
    Task<bool> CancelGenerationAsync(string userId, string chatId, string messageId);

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
