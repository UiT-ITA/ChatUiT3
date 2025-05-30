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
    Task<List<AiChatHeader>> GetChatListAsync(string userId);
    Task<AiChat?> GetChatByIdAsync(string userId, string chatId);
    Task AddChatAsync(string userId, AiChat chat);
    Task DeleteChatAsync(string userId, string chatId);
    Task UpdateChatAsync(string userId, string chatId, string? newTitle, string? newAssistantId = null);

    // Message management
    Task AddMessageAsync(string userId, string chatId, AiChatMessage message);
    Task UpdateMessageAsync(string userId, string chatId, AiChatMessage message);
    Task DeleteMessageAsync(string userId, string chatId, string messageId);

    // Endpoint management
    Task<List<AiModelEndpoint>> GetEndpointsAsync();
    Task<AiModelEndpoint?> GetEndpointByIdAsync(string endpointId);
    Task<string> CreateEndpointAsync(AiModelEndpoint endpoint);
    Task<bool> UpdateEndpointAsync(AiModelEndpoint endpoint);
    Task<bool> DeleteEndpointAsync(string endpointId);

    // Model management
    Task<List<AiModel>> GetModelsAsync();
    Task<AiModel?> GetModelByIdAsync(string modelId);
    Task<string> CreateModelAsync(AiModel model);
    Task<bool> UpdateModelAsync(AiModel model);
    Task<bool> DeleteModelAsync(string modelId);

    // Assistant management
    Task<List<AiAssistant>> GetAssistantsByOwnerAsync(string ownerId);
    Task<List<AiAssistant>> GetSystemAssistantsAsync();
    Task<List<AiAssistant>> GetAssistantsByIdsAsync(List<string> assistantIds);
    Task<AiAssistant?> GetAssistantByIdAsync(string assistantId);
    Task<AiAssistant> CreateAssistantAsync(AiAssistant assistant);
    Task<AiAssistant?> UpdateAssistantAsync(AiAssistant assistant);
    Task<bool> DeleteAssistantAsync(string assistantId);
}
