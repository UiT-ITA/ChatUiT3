using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService
{
    public Task<List<AiChatHeader>> GetChatListAsync(string userId)
    {
        AddUserToService(userId);

        var chatList = new List<AiChatHeader>();
        chatList.AddRange(_chatStorage[userId].Select(chat => new AiChatHeader
        {
            Id = chat.Id,
            Name = chat.Name,
            CreatedAt = chat.CreatedAt,
            UpdatedAt = chat.UpdatedAt
        }));

        return Task.FromResult(chatList);
    }

    public Task<AiChat?> GetChatByIdAsync(string userId, string chatId)
    {
        AddUserToService(userId);

        AiChat? chat = _chatStorage[userId].FirstOrDefault(c => c.Id == chatId);
        if (chat != null)
        {
            chat = new AiChat
            {
                Id = chat.Id,
                Name = chat.Name,
                Messages = chat.Messages.Select(m => new AiChatMessage
                {
                    Id = m.Id,
                    Role = m.Role,
                    Content = m.Content,
                    Timestamp = m.Timestamp,
                    Status = m.Status,
                }).ToList(),
                AssistantId = chat.AssistantId
            };
        }
        return Task.FromResult<AiChat?>(chat);
    }

    public Task AddChatAsync(string userId, AiChat chat)
    {
        AddUserToService(userId);
        _chatStorage[userId].Add(chat);
        return Task.CompletedTask;
    }

    public Task DeleteChatAsync(string userId, string chatId)
    {
        AddUserToService(userId);

        var chat = _chatStorage[userId].FirstOrDefault(c => c.Id == chatId);
        if (chat != null)
        {
            _chatStorage[userId].Remove(chat);
        }

        return Task.CompletedTask;
    }

    public Task UpdateChatAsync(string userId, string chatId, string? newTitle, string? newAssistantId = null)
    {
        if (string.IsNullOrEmpty(newTitle) && string.IsNullOrEmpty(newAssistantId))
        {
            return Task.CompletedTask;
        }

        AddUserToService(userId);

        var chat = _chatStorage[userId].FirstOrDefault(c => c.Id == chatId);
        
        if (chat != null)
        {
            if (!string.IsNullOrEmpty(newTitle))
            {
                chat.Name = newTitle;
            }
            if (!string.IsNullOrEmpty(newAssistantId))
            {
                chat.AssistantId = newAssistantId;
            }
        }
        
        return Task.CompletedTask;
    }
}
