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
    /// <summary>
    /// Pins an on-demand assistant file to the chat. A file already pinned is left as is.
    /// Returns false when the chat does not exist.
    /// </summary>
    Task<bool> AddChatLoadedFileAsync(string userId, string chatId, ChatLoadedFile file);

    // Message management
    Task AddMessageAsync(string userId, string chatId, ChatMessage message);
    Task UpdateMessageAsync(string userId, string chatId, ChatMessage message);
    Task DeleteMessageAsync(string userId, string chatId, string messageId);
    Task SetMessageTokenCountsAsync(string userId, string chatId, string messageId, IReadOnlyDictionary<string, int> tokenCounts, IReadOnlyDictionary<string, int> fileTokenCounts);

    // App settings
    Task<AppSettings> GetAppSettingsAsync();
    Task UpdateAppSettingsAsync(AppSettings settings);

    // Tool policies (admin overrides of a tool's code default)
    Task<List<ToolPolicy>> GetToolPoliciesAsync();
    Task UpsertToolPolicyAsync(ToolPolicy policy);
    Task<bool> DeleteToolPolicyAsync(string toolId);

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
