using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public interface IDatabaseService
{
    // User management
    Task<UserInfo> GetUserInfoAsync(string userId);
    Task<bool> UpdateUserInfoAsync(string userId, UserInfo userInfo);
    Task<UserInfo?> GetUserAsync(string userId);
    Task<bool> UpdateUserAsync(UserInfo user);

    // Chat management
    Task<List<ChatHeader>> GetChatListAsync(string userId);
    Task<Chat?> GetChatByIdAsync(string userId, string chatId, bool includeFileContent = true);
    Task<ChatFile?> GetChatFileAsync(string userId, string chatId, string fileId);
    Task AddChatAsync(string userId, Chat chat);
    Task DeleteChatAsync(string userId, string chatId);
    Task UpdateChatAsync(string userId, string chatId, string? newTitle, string? newAssistantId = null);
    Task SetChatFavoriteAsync(string userId, string chatId, bool isFavorite);

    // Message management
    Task AddMessageAsync(string userId, string chatId, ChatMessage message);
    Task UpdateMessageAsync(string userId, string chatId, ChatMessage message);
    Task DeleteMessageAsync(string userId, string chatId, string messageId);

    // App settings
    Task<AppSettings> GetAppSettingsAsync();
    Task UpdateAppSettingsAsync(AppSettings settings);

    // Endpoint management
    Task<List<ModelEndpoint>> GetEndpointsAsync();
    Task<ModelEndpoint?> GetEndpointByIdAsync(string endpointId);
    Task<string> CreateEndpointAsync(ModelEndpoint endpoint);
    Task<bool> UpdateEndpointAsync(ModelEndpoint endpoint);
    Task<bool> DeleteEndpointAsync(string endpointId);

    // Model management
    Task<List<Model>> GetModelsAsync();
    Task<Model?> GetModelByIdAsync(string modelId);
    Task<string> CreateModelAsync(Model model);
    Task<bool> UpdateModelAsync(Model model);
    Task<bool> DeleteModelAsync(string modelId);

    // Assistant management
    Task<List<Assistant>> GetAssistantsByOwnerAsync(string ownerId);
    Task<List<Assistant>> GetSystemAssistantsAsync();
    Task<List<Assistant>> GetAssistantsByIdsAsync(List<string> assistantIds);
    Task<Assistant?> GetAssistantByIdAsync(string assistantId, bool includeFileContent = false);
    Task<AssistantFile?> GetAssistantFileAsync(string assistantId, string fileId);
    Task<Assistant> CreateAssistantAsync(Assistant assistant);
    Task<Assistant?> UpdateAssistantAsync(Assistant assistant);
    Task<bool> DeleteAssistantAsync(string assistantId);
}
