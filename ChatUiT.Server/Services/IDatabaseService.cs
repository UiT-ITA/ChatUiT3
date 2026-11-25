using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Agents;

namespace ChatUiT.Server.Services;

public interface IDatabaseService
{
    // User management
    Task<UserInfo> GetUserInfoAsync(string userId);
    Task<bool> UpdateUserInfoAsync(string userId, UserInfo userInfo);
    Task<UserInfo?> GetUserAsync(string userId);
    Task<bool> UpdateUserAsync(UserInfo user);
    Task SetUserTrainingAsync(string userId, TrainingResult training);

    // Chat management
    Task<List<ChatHeader>> GetChatListAsync(string userId);
    /// <summary>The chat without its messages.</summary>
    Task<ChatHeader?> GetChatHeaderAsync(string userId, string chatId);
    /// <summary>The chat with its messages. The files come without their content.</summary>
    Task<Chat?> GetChatByIdAsync(string userId, string chatId);
    /// <summary>A file on a message of the chat, without its content.</summary>
    Task<ChatFile?> GetChatFileAsync(string userId, string chatId, string fileId);
    /// <summary>The chat's files, each with the id of its message.</summary>
    Task<List<MessageFile>> GetChatFilesAsync(string userId, string chatId);
    /// <summary>Sets IsEncrypted on a file on a message. False when the message has no such file.</summary>
    Task<bool> MarkChatFileEncryptedAsync(string userId, string chatId, string messageId, string fileId);
    Task AddChatAsync(string userId, Chat chat);
    Task DeleteChatAsync(string userId, string chatId);
    Task UpdateChatAsync(string userId, string chatId, string? newTitle, string? newAssistantId = null);
    Task SetChatFavoriteAsync(string userId, string chatId, bool isFavorite);
    Task EnableRedAsync(string userId, string chatId, string? assistantId);
    /// <summary>
    /// Pins an on-demand assistant file to the chat. A file already pinned is left as is.
    /// Returns false when the chat does not exist.
    /// </summary>
    Task<bool> AddChatLoadedFileAsync(string userId, string chatId, ChatLoadedFile file);

    // Message management
    Task AddMessageAsync(string userId, string chatId, ChatMessage message);
    /// <summary>The message with its text and its files, without the files' content. Null when the chat has no such message.</summary>
    Task<ChatMessage?> GetMessageAsync(string userId, string chatId, string messageId);
    /// <summary>
    /// Changes a message from status New to Success, with the timestamp. False when the chat has
    /// no such message with status New, so only one caller gets true for a message.
    /// </summary>
    Task<bool> MarkMessageSentAsync(string userId, string chatId, string messageId, DateTime timestamp);
    /// <summary>Adds a file to a message with status New, and sets the message's timestamp to now. False when the chat has no such message.</summary>
    Task<bool> AddMessageFileAsync(string userId, string chatId, string messageId, ChatFile file);
    Task UpdateMessageAsync(string userId, string chatId, ChatMessage message);
    /// <summary>Deletes the message with its content in the database. Returns its files, whose blobs are not deleted.</summary>
    Task<List<ChatFile>> DeleteMessageAsync(string userId, string chatId, string messageId);
    Task SetMessageTokenCountsAsync(string userId, string chatId, string messageId, IReadOnlyDictionary<string, int> tokenCounts, IReadOnlyDictionary<string, int> fileTokenCounts);

    // App settings
    Task<AppSettings> GetAppSettingsAsync();
    Task UpdateAppSettingsAsync(AppSettings settings);

    // Tool policies (admin overrides of a tool's code default)
    Task<List<ToolPolicy>> GetToolPoliciesAsync();
    Task UpsertToolPolicyAsync(ToolPolicy policy);
    Task<bool> DeleteToolPolicyAsync(string toolId);

    // Internal agent settings (the model and reasoning level each agent runs on, and whether the Responses API serves it)
    Task<List<InternalAgentSetting>> GetInternalAgentSettingsAsync();
    Task UpsertInternalAgentSettingAsync(InternalAgentSetting setting);

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
    /// <summary>The assistant. The files come without their content.</summary>
    Task<Assistant?> GetAssistantByIdAsync(string assistantId);
    /// <summary>A file of the assistant, without its content.</summary>
    Task<AssistantFile?> GetAssistantFileAsync(string assistantId, string fileId);
    /// <summary>Adds a file to the assistant. False when the assistant does not exist.</summary>
    Task<bool> AddAssistantFileAsync(string assistantId, AssistantFile file);
    Task<Assistant> CreateAssistantAsync(Assistant assistant);
    /// <summary>Saves the assistant. Its files must be files it already has. Files it no longer has are removed from it, and their blobs are not deleted.</summary>
    Task<AssistantUpdate?> UpdateAssistantAsync(Assistant assistant);
    Task<bool> DeleteAssistantAsync(string assistantId);
}

/// <summary>A saved assistant, and the files it no longer has.</summary>
public sealed record AssistantUpdate(Assistant Assistant, List<AssistantFile> RemovedFiles);

/// <summary>A file and the id of the message it is on.</summary>
public sealed record MessageFile(string MessageId, ChatFile File);
