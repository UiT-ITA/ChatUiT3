using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public interface IChatService
{
    // Chat Management
    Task<List<AiChat>> GetChatsAsync(string userId);
    Task<AiChat?> GetChatByIdAsync(string userId, string chatId);
    Task<AiChat> CreateChatAsync(string userId, string title, AiModelSettings settings);
    Task<AiChat> CreateChatWithMessageAsync(string userId, string title, AiChatMessage initialMessage, AiModelSettings settings);
    Task<AiChat?> RenameChatAsync(string userId, string chatId, string newTitle);
    Task<bool> DeleteChatAsync(string userId, string chatId);
    
    // Message Operations
    Task<AiChatMessage> AddMessageAsync(string userId, string chatId, AiChatMessage message);
    Task<AiChatMessage> AddMessageAsync(string userId, string chatId, string textContent);
    
    // AI Response
    Task<AiChatMessage> GetAiResponseAsync(string userId, string chatId, AiChatMessage userMessage);
    Task<AiChatMessage> GetAiResponseAsync(string userId, string chatId, string textContent);
    
    // Streaming AI Response
    Task StartStreamingResponseAsync(string userId, string chatId, AiChatMessage userMessage);
    Task StartStreamingResponseAsync(string userId, string chatId, string textContent);
    
    // Settings
    Task<AiChat?> UpdateChatSettingsAsync(string userId, string chatId, AiModelSettings settings);
}
