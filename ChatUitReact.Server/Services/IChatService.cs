using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public interface IChatService
{    
    // Chat Management
    Task<List<ChatHeader>> GetChatListAsync(string userId);
    Task<List<Chat>> GetChatsAsync(string userId);
    Task<Chat?> GetChatByIdAsync(string userId, string chatId);
    Task<Chat> CreateChatAsync(string userId, string assistantId, List<ChatMessage> messages);
    Task UpdateChatAsync(string userId, string chatId, string? newTitle, string? newAssistantId = null);
    Task DeleteChatAsync(string userId, string chatId);
    
    // Message Operations
    Task SendMessageAsync(string userId, string chatId, ChatMessage message);
    Task SendMessageAsync(string userId, string chatId, ChatMessage message, string? assistantId);
    Task SendStreamingMessageAsync(string userId, string chatId, ChatMessage message);
    Task SendStreamingMessageAsync(string userId, string chatId, ChatMessage message, string assistantId);
    Task AddMessageAsync(string userId, string chatId, ChatMessage message);
    Task DeleteMessageAsync(string userId, string chatId, string messageId);

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
