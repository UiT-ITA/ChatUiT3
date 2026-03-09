using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class DatabaseService
{
    // Conversation management
    public Task<List<ChatHeader>> GetChatListAsync(string userId)
    {
        throw new NotImplementedException();
    }

    public Task<Chat?> GetChatByIdAsync(string userId, string chatId)
    {
        throw new NotImplementedException();
    }

    public Task AddChatAsync(string userId, Chat chat)
    {
        throw new NotImplementedException();
    }

    public Task RemoveChatAsync(string userId) { 
        throw new NotImplementedException(); 
    } 

    public Task DeleteChatAsync(string userId, string chatId)
    {
        throw new NotImplementedException();
    }

    public Task UpdateChatAsync(string userId, string chatId, string? newTitle, string? newAssistantId = null)
    {
        throw new NotImplementedException();
    }

    // Message management
    public Task AddMessageAsync(string userId, string chatId, ChatMessage message)
    {
        throw new NotImplementedException();
    }

    public Task UpdateMessageAsync(string userId, string chatId, ChatMessage message)
    {
        throw new NotImplementedException();
    }

    public Task DeleteMessageAsync(string userId, string chatId, string messageId)
    {
        throw new NotImplementedException();
    }
}
