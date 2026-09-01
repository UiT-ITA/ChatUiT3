using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService
{
    public Task AddMessageAsync(string userId, string chatId, ChatMessage message)
    {
        AddUser(userId);
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
        AddUser(userId);
        var chat = _chatStorage[userId].FirstOrDefault(c => c.Id == chatId);
        if (chat != null)
        {
            var existingMessage = chat.Messages.FirstOrDefault(m => m.Id == message.Id);
            if (existingMessage != null)
            {
                existingMessage.Content = message.Content;
                existingMessage.Timestamp = message.Timestamp;
                existingMessage.Status = message.Status;
                // CRITICAL FIX: Preserve files when updating message
                if (message.Files != null && message.Files.Count > 0)
                {
                    existingMessage.Files = message.Files;
                }
                // Same reason as files: callers that build a partial message leave these blank.
                if (!string.IsNullOrWhiteSpace(message.AssistantId))
                {
                    existingMessage.AssistantId = message.AssistantId;
                }
                if (!string.IsNullOrWhiteSpace(message.AssistantName))
                {
                    existingMessage.AssistantName = message.AssistantName;
                }
            }
            chat.UpdatedAt = DateTime.Now;
        }
        return Task.CompletedTask;
    }

    public Task DeleteMessageAsync(string userId, string chatId, string messageId)
    {
        AddUser(userId);
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
