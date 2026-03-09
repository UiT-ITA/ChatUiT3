using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService
{
    public Task<List<ChatHeader>> GetChatListAsync(string userId)
    {
        AddUser(userId);

        var chatHeaders = _chatStorage[userId].Select(chat => DeepCopyChatHeader(chat)).ToList();
        return Task.FromResult(chatHeaders);
    }

    public Task<Chat?> GetChatByIdAsync(string userId, string chatId)
    {
        AddUser(userId);

        var chat = _chatStorage[userId].FirstOrDefault(c => c.Id == chatId);
        return Task.FromResult(chat != null ? DeepCopyChat(chat) : null);
    }

    public Task AddChatAsync(string userId, Chat chat)
    {
        AddUser(userId);
        var chatCopy = DeepCopyChat(chat);
        _chatStorage[userId].Add(chatCopy);
        return Task.CompletedTask;
    }

    public Task DeleteChatAsync(string userId, string chatId)
    {
        AddUser(userId);

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

        AddUser(userId);

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
