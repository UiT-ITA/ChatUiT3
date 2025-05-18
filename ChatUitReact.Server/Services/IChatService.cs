using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public interface IChatService
{    
    // Chat Management
    Task<List<AiChatHeader>> GetChatListAsync(string userId);
    Task<List<AiChat>> GetChatsAsync(string userId);
    Task<AiChat?> GetChatByIdAsync(string userId, string chatId);
    Task<AiChat> CreateChatAsync(string userId, AiChatSettings settings, List<AiChatMessage> messages);
    Task UpdateChatAsync(string userId, string chatId, AiChatSettings? settings, string? newTitle);
    Task DeleteChatAsync(string userId, string chatId);
    
    // Message Operations
    Task AddMessageAsync(string userId, string chatId, AiChatMessage message);
    Task DeleteMessageAsync(string userId, string chatId, string messageId);

    // AI Response
    Task<string> GetResponseAsync(string userId, string chatId, AiChatMessage userMessage);
    Task<string> GetResponseAsync(string userId, string chatId);

    // AI Response without chat
    Task<string> GetResponseAsync(string userId, AiModelSettings settings, List<AiChatMessage> messages);

    // Streaming AI Response
    // Response is a stream of strings, which can be concatenated to form the full response.
    Task<string> GetStreamingResponseAsync(string userId, string chatId, AiChatMessage userMessage);
    Task<string> GetStreamingResponseAsync(string userId, string chatId);

    // Streaming AI Response without chat
    Task<string> GetStreamingResponseAsync(string userId, AiModelSettings settings, List<AiChatMessage> messages);

}
