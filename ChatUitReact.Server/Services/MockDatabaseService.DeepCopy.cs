using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService
{
    private static UserInfo DeepCopyUserInfo(UserInfo userInfo)
    {
        return new UserInfo
        {
            Username = userInfo.Username,
            Roles = new List<UserRole>(userInfo.Roles),
            Preferences = new UserPreferences
            {
                Notifications = new NotificationSettings
                {
                    DismissedNotifications = new Dictionary<string, bool>(userInfo.Preferences.Notifications.DismissedNotifications)
                },
                Display = new DisplaySettings
                {
                    Theme = userInfo.Preferences.Display.Theme,
                    Language = userInfo.Preferences.Display.Language,
                    CompactMode = userInfo.Preferences.Display.CompactMode,
                    FontSize = userInfo.Preferences.Display.FontSize
                },
                SharedAssistantIds = new List<string>(userInfo.Preferences.SharedAssistantIds),
                FavoritedAssistantIds = new List<string>(userInfo.Preferences.FavoritedAssistantIds),
                HiddenAssistantIds = new List<string>(userInfo.Preferences.HiddenAssistantIds),
                DefaultAssistantId = userInfo.Preferences.DefaultAssistantId
            }
        };
    }

    private static Assistant DeepCopyAssistant(Assistant assistant)
    {
        return new Assistant
        {
            Id = assistant.Id,
            Name = assistant.Name,
            Description = assistant.Description,
            Tags = new List<string>(assistant.Tags),
            ChatSettings = new ChatSettings
            {
                SystemPrompt = assistant.ChatSettings.SystemPrompt,
                Temperature = assistant.ChatSettings.Temperature,
                ReasoningEffort = assistant.ChatSettings.ReasoningEffort,
                Model = DeepCopyModel(assistant.ChatSettings.Model),
                AvailableToolIds = new List<string>(assistant.ChatSettings.AvailableToolIds)
            },
            Files = assistant.Files.Select(DeepCopyAssistantFile).ToList(),
            OwnerId = assistant.OwnerId,
            UpdatedAt = assistant.UpdatedAt
        };
    }

    private static AssistantFile DeepCopyAssistantFile(AssistantFile file)
    {
        return new AssistantFile
        {
            Id = file.Id,
            SourceFilename = file.SourceFilename,
            Category = file.Category,
            Description = file.Description,
            Chunks = file.Chunks.Select(chunk => new ChatFileChunk
            {
                Id = chunk.Id,
                Type = chunk.Type,
                Text = chunk.Text,
                Format = chunk.Format,
                Base64 = chunk.Base64
            }).ToList()
        };
    }

    private static Model DeepCopyModel(Model model)
    {
        return new Model
        {
            Id = model.Id,
            ModelId = model.ModelId,
            ModelName = model.ModelName,
            Description = model.Description,
            EndpointId = model.EndpointId,
            AllowedRoles = new List<UserRole>(model.AllowedRoles),
            AllowedAsDefault = model.AllowedAsDefault,
            Capabilities = new ModelCapabilities
            {
                SupportsVision = model.Capabilities.SupportsVision,
                SupportsFunctionCalling = model.Capabilities.SupportsFunctionCalling,
                Temperature = model.Capabilities.Temperature,
                SupportedEfforts = new List<ReasoningEffort>(model.Capabilities.SupportedEfforts),
                MaxContextTokens = model.Capabilities.MaxContextTokens,
                MaxOutputTokens = model.Capabilities.MaxOutputTokens,
                DefaultMaxOutputTokens = model.Capabilities.DefaultMaxOutputTokens,
                KnowledgeCutoff = model.Capabilities.KnowledgeCutoff,
                TokenCountingScheme = model.Capabilities.TokenCountingScheme
            }
        };
    }

    private static Chat DeepCopyChat(Chat chat)
    {
        return new Chat
        {
            Id = chat.Id,
            Name = chat.Name,
            CreatedAt = chat.CreatedAt,
            UpdatedAt = chat.UpdatedAt,
            Status = chat.Status,
            IsFavorite = chat.IsFavorite,
            AssistantId = chat.AssistantId,
            Messages = chat.Messages.Select(m => new ChatMessage
            {
                Id = m.Id,
                Role = m.Role,
                Timestamp = m.Timestamp,
                Content = m.Content,
                Status = m.Status,
                Files = m.Files,
                AssistantId = m.AssistantId,
                AssistantName = m.AssistantName,
                TokenCounts = new Dictionary<string, int>(m.TokenCounts),
                FileTokenCounts = new Dictionary<string, int>(m.FileTokenCounts)
            }).ToList()
        };
    }

    private static ChatHeader DeepCopyChatHeader(ChatHeader chatHeader)
    {
        return new ChatHeader
        {
            Id = chatHeader.Id,
            Name = chatHeader.Name,
            CreatedAt = chatHeader.CreatedAt,
            UpdatedAt = chatHeader.UpdatedAt,
            Status = chatHeader.Status,
            IsFavorite = chatHeader.IsFavorite
        };
    }

    private static ModelEndpoint DeepCopyModelEndpoint(ModelEndpoint endpoint)
    {
        return new ModelEndpoint
        {
            Id = endpoint.Id,
            Url = endpoint.Url,
            ApiKey = endpoint.ApiKey,
            EndpointType = endpoint.EndpointType
        };
    }

    private static List<T> DeepCopyList<T>(List<T> list, Func<T, T> copyFunc)
    {
        if (list == null) return new List<T>();
        return list.Select(copyFunc).ToList();
    }
}
