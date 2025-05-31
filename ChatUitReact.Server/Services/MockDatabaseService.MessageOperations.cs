using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService
{
    public Task AddMessageAsync(string userId, string chatId, ChatMessage message)
    {
        AddUserToService(userId);
        var chat = _chatStorage[userId].FirstOrDefault(c => c.Id == chatId);
        if (chat != null)
        {
            chat.Messages.Add(message);
            chat.UpdatedAt = DateTime.Now;
        }
        return Task.CompletedTask;
    }

    public Task UpdateMessageAsync(string userId, string chatId, ChatMessage message)
    {
        AddUserToService(userId);
        var chat = _chatStorage[userId].FirstOrDefault(c => c.Id == chatId);
        if (chat != null)
        {
            var existingMessage = chat.Messages.FirstOrDefault(m => m.Id == message.Id);
            if (existingMessage != null)
            {
                existingMessage.Content = message.Content;
                existingMessage.Timestamp = message.Timestamp;
            }
            chat.UpdatedAt = DateTime.Now;
        }
        return Task.CompletedTask;
    }

    public Task DeleteMessageAsync(string userId, string chatId, string messageId)
    {
        AddUserToService(userId);
        var chat = _chatStorage[userId].FirstOrDefault(c => c.Id == chatId);
        if (chat != null)
        {
            var message = chat.Messages.FirstOrDefault(m => m.Id == messageId);
            if (message != null)
            {
                chat.Messages.Remove(message);
            }
            chat.UpdatedAt = DateTime.Now;
        }
        return Task.CompletedTask;
    }
}
