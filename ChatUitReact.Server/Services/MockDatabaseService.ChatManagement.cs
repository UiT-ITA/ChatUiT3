using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService
{
    public Task<List<ChatHeader>> GetChatListAsync(string userId)
    {
        AddUserToService(userId);

        var chatList = new List<ChatHeader>();
        chatList.AddRange(_chatStorage[userId].Select(chat => new ChatHeader
        {
            Id = chat.Id,
            Name = chat.Name,
            CreatedAt = chat.CreatedAt,
            UpdatedAt = chat.UpdatedAt,
            Status = chat.Status
        }));

        return Task.FromResult(chatList);
    }

    public Task<Chat?> GetChatByIdAsync(string userId, string chatId)
    {
        AddUserToService(userId);

        Chat? chat = _chatStorage[userId].FirstOrDefault(c => c.Id == chatId);
        if (chat != null)
        {
            chat = new Chat
            {
                Id = chat.Id,
                Name = chat.Name,
                Messages = chat.Messages.Select(m => new ChatMessage
                {
                    Id = m.Id,
                    Role = m.Role,
                    Content = m.Content,
                    Timestamp = m.Timestamp,
                    Status = m.Status,
                }).ToList(),
                AssistantId = chat.AssistantId,
                Status = chat.Status,
                CreatedAt = chat.CreatedAt,
                UpdatedAt = chat.UpdatedAt
            };
        }
        return Task.FromResult<Chat?>(chat);
    }

    public Task AddChatAsync(string userId, Chat chat)
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
