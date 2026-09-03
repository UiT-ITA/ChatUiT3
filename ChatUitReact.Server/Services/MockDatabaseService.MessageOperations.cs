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
                // Callers that build a partial message leave Files blank, so keep the stored files.
                if (message.Files != null && message.Files.Count > 0)
                {
                    existingMessage.Files = message.Files;
                }
                // Same for these: a partial message leaves them blank, so only overwrite when set.
                if (!string.IsNullOrWhiteSpace(message.AssistantId))
                {
                    existingMessage.AssistantId = message.AssistantId;
                }
                if (!string.IsNullOrWhiteSpace(message.AssistantName))
                {
                    existingMessage.AssistantName = message.AssistantName;
                }
                if (message.TokenCounts is { Count: > 0 })
                {
                    existingMessage.TokenCounts = message.TokenCounts;
                }
                if (message.FileTokenCounts is { Count: > 0 })
                {
                    existingMessage.FileTokenCounts = message.FileTokenCounts;
                }
            }
            chat.UpdatedAt = DateTime.Now;
        }
        return Task.CompletedTask;
    }

    public Task SetMessageTokenCountsAsync(string userId, string chatId, string messageId, IReadOnlyDictionary<string, int> tokenCounts, IReadOnlyDictionary<string, int> fileTokenCounts)
    {
        AddUser(userId);
        var chat = _chatStorage[userId].FirstOrDefault(c => c.Id == chatId);
        var message = chat?.Messages.FirstOrDefault(m => m.Id == messageId);
        if (message != null)
        {
            message.TokenCounts = new Dictionary<string, int>(tokenCounts);
            message.FileTokenCounts = new Dictionary<string, int>(fileTokenCounts);
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
