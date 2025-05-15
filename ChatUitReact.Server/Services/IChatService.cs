using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

/// <summary>
/// Interface for comprehensive chat service operations
/// </summary>
public interface IChatService
{
    #region Chat Management
    
    /// <summary>
    /// Get all chats for a user
    /// </summary>
    Task<List<AiChat>> GetChatsForUserAsync(string userId);
    
    /// <summary>
    /// Get a specific chat with all its messages
    /// </summary>
    Task<AiChat?> GetChatByIdAsync(string userId, string chatId);
    
    /// <summary>
    /// Create a new chat
    /// </summary>
    Task<AiChat> CreateChatAsync(string userId, string title, string? assistantId = null);
    
    /// <summary>
    /// Update a chat's title
    /// </summary>
    Task<AiChat?> UpdateChatTitleAsync(string userId, string chatId, string newTitle);
    
    /// <summary>
    /// Delete a chat
    /// </summary>
    Task<bool> DeleteChatAsync(string userId, string chatId);
    
    #endregion
    
    #region Message Operations
    
    /// <summary>
    /// Add a user message to a chat and prepare for response
    /// </summary>
    Task<(AiChatMessage UserMessage, AiChatMessage AssistantMessage)> PrepareUserMessageAsync(string userId, string chatId, string text);
    
    /// <summary>
    /// Update a message with final content
    /// </summary>
    Task<bool> UpdateMessageAsync(string userId, string chatId, string messageId, string finalContent);
    
    /// <summary>
    /// Stream a response to a user message
    /// </summary>
    Task StreamResponseAsync(string userId, string chatId, string messageId);
    
    /// <summary>
    /// Add a message to a chat (non-streaming)
    /// </summary>
    Task<AiChatMessage> AddMessageAsync(string userId, string chatId, string text);
    
    /// <summary>
    /// Get all messages for a particular chat
    /// </summary>
    Task<List<AiChatMessage>> GetMessagesAsync(string userId, string chatId);
    
    #endregion
    
    #region File Handling
    
    /// <summary>
    /// Upload a file to a chat and process it
    /// </summary>
    Task<AiChatFile> UploadFileAsync(string userId, string chatId, string fileName, string contentType, byte[] fileData);
    
    /// <summary>
    /// Attach an existing file to a message
    /// </summary>
    Task<bool> AttachFileToMessageAsync(string userId, string chatId, string messageId, string fileId);
    
    /// <summary>
    /// Get a file by its ID
    /// </summary>
    Task<AiChatFile?> GetFileAsync(string userId, string chatId, string fileId);
    
    /// <summary>
    /// Download file content
    /// </summary>
    Task<byte[]?> DownloadFileAsync(string userId, string chatId, string fileId);
    
    /// <summary>
    /// Delete a file from a chat
    /// </summary>
    Task<bool> DeleteFileAsync(string userId, string chatId, string fileId);
    
    #endregion
    
    #region Model Settings
    
    /// <summary>
    /// Update model settings for a chat
    /// </summary>
    Task<AiChat?> UpdateModelSettingsAsync(string userId, string chatId, AiModelSettings settings);
    
    /// <summary>
    /// Get available models for chat
    /// </summary>
    Task<List<AiModel>> GetAvailableModelsAsync();
    
    #endregion
    
    #region Tools and Function Calling
    
    /// <summary>
    /// Execute a tool function within a chat
    /// </summary>
    Task<AiChatMessage> ExecuteToolAsync(string userId, string chatId, string messageId, string toolId, string arguments);
    
    /// <summary>
    /// Get available tools for an assistant
    /// </summary>
    Task<List<AiChatTool>> GetAvailableToolsAsync(string assistantId);
    
    #endregion
}
