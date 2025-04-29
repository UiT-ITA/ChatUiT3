using ChatUitReact.Server.Models;
using ChatUitReact.Server.Models.DTOs;

namespace ChatUitReact.Server.Services.Mapping;

/// <summary>
/// Service responsible for mapping between domain models and DTOs.
/// This service will be used across the application regardless of data source.
/// </summary>
public class MapperService
{
    #region Assistant Mapping
    
    public AiAssistantDto MapToAssistantDto(AiAssistant assistant)
    {
        if (assistant == null) return null;
        
        return new AiAssistantDto
        {
            Id = assistant.Id,
            Name = assistant.Name,
            Description = assistant.Description,
            IsSystemCreated = assistant.IsSystemCreated,
            Model = MapToModelDto(assistant.Model),
            ModelSettings = MapToModelSettingsDto(assistant.ModelSettings),
            Tools = assistant.Tools?.Select(MapToToolDto).ToList() ?? new List<AiChatToolDto>()
        };
    }
    
    public AiChatToolDto MapToToolDto(AiChatTool tool)
    {
        if (tool == null) return null;
        
        return new AiChatToolDto
        {
            Id = tool.Id,
            Name = tool.Name,
            Description = tool.Description,
            Type = tool.Type.ToString().ToLower()
        };
    }
    
    #endregion
    
    #region Model Mapping
    
    public AiModelDto MapToModelDto(AiModel model)
    {
        if (model == null) return null;
        
        return new AiModelDto
        {
            Id = model.Id,
            Name = model.Name,
            Description = model.Description,
            ModelType = model.ModelType.ToString(),
            Capabilities = MapToModelCapabilitiesDto(model.Capabilities)
        };
    }
    
    public AiModelCapabilitiesDto MapToModelCapabilitiesDto(AiModelCapabilities capabilities)
    {
        if (capabilities == null) return null;
        
        return new AiModelCapabilitiesDto
        {
            SupportsVision = capabilities.SupportsVision,
            SupportsReasoning = capabilities.SupportsReasoning,
            SupportsFunctionCalling = capabilities.SupportsFunctionCalling,
            MaxContextLength = capabilities.MaxContextLength
        };
    }
    
    public AiModelSettingsDto MapToModelSettingsDto(AiModelSettings settings)
    {
        if (settings == null) return null;
        
        return new AiModelSettingsDto
        {
            Temperature = settings.Temperature,
            MaxTokens = settings.MaxTokens,
            TopP = settings.TopP,
            ReasoningEffort = settings.ReasoningEffort.ToString().ToLower()
        };
    }
    
    #endregion
    
    #region Chat Mapping
    
    public AiChatDto MapToChatDto(AiChat chat)
    {
        if (chat == null) return null;
        
        return new AiChatDto
        {
            Id = chat.Id,
            UserId = chat.UserId,
            Name = chat.Name,
            Assistant = MapToAssistantDto(chat.Assistant),
            CurrentSettings = MapToModelSettingsDto(chat.CurrentSettings),
            CreatedAt = chat.CreatedAt,
            UpdatedAt = chat.UpdatedAt,
            Messages = chat.Messages?.Select(m => MapToChatMessageDto(m, chat.Files)).ToList() ?? new List<AiChatMessageDto>(),
            Files = chat.Files?.Select(MapToFileDto).ToList() ?? new List<AiChatFileDto>()
        };
    }
    
    public AiChatSummaryDto MapToChatSummaryDto(AiChat chat)
    {
        if (chat == null) return null;
        
        var lastMessage = chat.Messages?.OrderByDescending(m => m.Timestamp).FirstOrDefault();
        var previewText = lastMessage?.Content ?? "";
        if (previewText.Length > 50)
        {
            previewText = previewText.Substring(0, 47) + "...";
        }

        return new AiChatSummaryDto
        {
            Id = chat.Id,
            Name = chat.Name,
            AssistantName = chat.Assistant.Name,
            CreatedAt = chat.CreatedAt,
            UpdatedAt = chat.UpdatedAt,
            LastMessagePreview = previewText,
            MessageCount = chat.Messages?.Count ?? 0
        };
    }
    
    public AiChatMessageDto MapToChatMessageDto(AiChatMessage message, List<AiChatFile> chatFiles)
    {
        if (message == null) return null;
        
        var files = new List<AiChatFileDto>();
        if (message.FileIds?.Any() == true && chatFiles?.Any() == true)
        {
            files = chatFiles
                .Where(f => message.FileIds.Contains(f.Id))
                .Select(MapToFileDto)
                .ToList();
        }

        return new AiChatMessageDto
        {
            Id = message.Id,
            Role = message.Role.ToString().ToLower(),
            Timestamp = message.Timestamp,
            Content = message.Content,
            Files = files
        };
    }
    
    public AiChatFileDto MapToFileDto(AiChatFile file)
    {
        if (file == null) return null;
        
        return new AiChatFileDto
        {
            Id = file.Id,
            FileName = file.FileName,
            ContentType = file.ContentType,
            Size = file.Size,
            UploadedAt = file.UploadedAt,
            IsProcessed = file.IsProcessed
        };
    }
    
    #endregion
    
    #region User Preferences Mapping
    
    public UserPreferencesDto MapToUserPreferencesDto(UserPreferences preferences)
    {
        if (preferences == null) return null;
        
        return new UserPreferencesDto
        {
            Theme = preferences.Theme,
            Language = preferences.Language,
            Notifications = new NotificationSettingsDto
            {
                EnableEmailNotifications = preferences.Notifications.EnableEmailNotifications,
                EnablePushNotifications = preferences.Notifications.EnablePushNotifications,
                DismissedNotifications = preferences.Notifications.DismissedNotifications
            },
            Display = new DisplaySettingsDto
            {
                CompactMode = preferences.Display.CompactMode,
                FontSize = preferences.Display.FontSize,
                ShowTimestamps = preferences.Display.ShowTimestamps
            }
        };
    }
    
    public UserPreferences MapToUserPreferences(string userId, UserPreferencesDto dto)
    {
        if (dto == null) return null;
        
        return new UserPreferences
        {
            UserId = userId,
            Theme = dto.Theme,
            Language = dto.Language,
            Notifications = new NotificationSettings
            {
                EnableEmailNotifications = dto.Notifications.EnableEmailNotifications,
                EnablePushNotifications = dto.Notifications.EnablePushNotifications,
                DismissedNotifications = dto.Notifications.DismissedNotifications
            },
            Display = new DisplaySettings
            {
                CompactMode = dto.Display.CompactMode,
                FontSize = dto.Display.FontSize,
                ShowTimestamps = dto.Display.ShowTimestamps
            }
        };
    }
    
    #endregion
    
    #region Domain to DTO Conversion
    
    // Additional mapping methods for creating domain models from DTOs can be added here
    public AiAssistant MapToAssistant(string userId, AiAssistantCreateDto dto, AiModel model, List<AiChatTool> tools)
    {
        if (dto == null) return null;
        
        var assistant = new AiAssistant
        {
            Id = Guid.NewGuid().ToString(),
            Name = dto.Name,
            Description = dto.Description,
            Model = model,
            SystemPrompt = dto.SystemPrompt,
            OwnerId = userId,
            IsSystemCreated = false,
            ModelSettings = new AiModelSettings
            {
                Temperature = dto.ModelSettings.Temperature,
                MaxTokens = dto.ModelSettings.MaxTokens,
                TopP = dto.ModelSettings.TopP,
                ReasoningEffort = ParseReasoningEffort(dto.ModelSettings.ReasoningEffort)
            },
            Tools = tools ?? new List<AiChatTool>()
        };
        
        return assistant;
    }
    
    public AiChat MapToChat(string userId, AiChatCreateDto dto, AiAssistant assistant)
    {
        if (dto == null || assistant == null) return null;
        
        var chat = new AiChat
        {
            Id = Guid.NewGuid().ToString(),
            UserId = userId,
            Name = string.IsNullOrWhiteSpace(dto.Name) 
                ? $"Chat with {assistant.Name}" 
                : dto.Name,
            Assistant = assistant,
            CurrentSettings = assistant.ModelSettings,
            CreatedAt = DateTime.UtcNow,
            Messages = new List<AiChatMessage>(),
            Files = new List<AiChatFile>()
        };
        
        return chat;
    }
    
    public AiChatMessage MapToChatMessage(AiChatMessageCreateDto dto, AiChatRole role)
    {
        if (dto == null) return null;
        
        return new AiChatMessage
        {
            Role = role,
            Content = dto.Content,
            Timestamp = DateTime.UtcNow,
            FileIds = dto.FileIds ?? new List<string>()
        };
    }
    
    #endregion
    
    #region Helper Methods
    
    private ReasoningEffort ParseReasoningEffort(string effort)
    {
        if (Enum.TryParse<ReasoningEffort>(effort, true, out var result))
        {
            return result;
        }
        return ReasoningEffort.None;
    }
    
    #endregion
}
