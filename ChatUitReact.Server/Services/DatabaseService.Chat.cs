using ChatUitReact.Server.Models;
using Microsoft.Azure.Cosmos;

namespace ChatUitReact.Server.Services;

public partial class DatabaseService
{
    // Conversation management
    public async Task<List<ChatHeader>> GetChatListAsync(string userId)
    {
        await EnsureInitializedAsync();

        var chatDocuments = await QueryItemsAsync<ChatDocument>(
            _chatContainer!,
            new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId ORDER BY c.updatedAt DESC")
                .WithParameter("@userId", userId),
            userId);

        return chatDocuments.Select(MapChatHeader).ToList();
    }

    public async Task<Chat?> GetChatByIdAsync(string userId, string chatId)
    {
        await EnsureInitializedAsync();

        var chatTask = ReadItemOrDefaultAsync<ChatDocument>(_chatContainer!, chatId, userId);
        var messageDocumentsTask = QueryItemsAsync<ChatMessageDocument>(
            _chatMessageContainer!,
            new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId AND c.chatId = @chatId ORDER BY c.timestamp ASC")
                .WithParameter("@userId", userId)
                .WithParameter("@chatId", chatId),
            userId);
        var contentBlocksTask = ReadContentBlockMapByChatAsync(userId, chatId);

        await Task.WhenAll(chatTask, messageDocumentsTask, contentBlocksTask);

        var chatDocument = await chatTask;

        if (chatDocument == null)
        {
            return null;
        }

        var messageDocuments = await messageDocumentsTask;
        var contentBlocksById = await contentBlocksTask;

        var messages = new List<ChatMessage>(messageDocuments.Count);
        foreach (var messageDocument in messageDocuments)
        {
            messages.Add(await MapChatMessageAsync(userId, messageDocument, contentBlocksById));
        }

        return new Chat
        {
            Id = chatDocument.Id,
            AssistantId = chatDocument.AssistantId,
            Name = chatDocument.Name,
            CreatedAt = chatDocument.CreatedAt,
            UpdatedAt = chatDocument.UpdatedAt,
            Status = chatDocument.Status,
            Messages = messages
        };
    }

    public async Task AddChatAsync(string userId, Chat chat)
    {
        await EnsureInitializedAsync();

        var chatId = string.IsNullOrWhiteSpace(chat.Id) ? Guid.NewGuid().ToString() : chat.Id;
        var createdAt = chat.CreatedAt == default ? DateTime.UtcNow : chat.CreatedAt;
        var updatedAt = chat.UpdatedAt == default ? createdAt : chat.UpdatedAt;

        var chatDocument = new ChatDocument
        {
            Id = chatId,
            UserId = userId,
            AssistantId = chat.AssistantId,
            Name = chat.Name,
            CreatedAt = createdAt,
            UpdatedAt = updatedAt,
            Status = chat.Status
        };

        await _chatContainer!.CreateItemAsync(chatDocument, new PartitionKey(userId));

        chat.Id = chatId;
        chat.CreatedAt = createdAt;
        chat.UpdatedAt = updatedAt;

        foreach (var message in chat.Messages)
        {
            await AddMessageAsync(userId, chatId, message);
        }
    }

    public async Task RemoveChatAsync(string userId)
    {
        await EnsureInitializedAsync();

        var chatIds = await QueryItemsAsync<IdOnlyDocument>(
            _chatContainer!,
            new QueryDefinition("SELECT c.id FROM c WHERE c.userId = @userId")
                .WithParameter("@userId", userId),
            userId);

        foreach (var chatId in chatIds)
        {
            await DeleteChatAsync(userId, chatId.Id);
        }
    } 

    public async Task DeleteChatAsync(string userId, string chatId)
    {
        await EnsureInitializedAsync();

        await DeleteChatContentAsync(userId, chatId);

        await DeleteItemsByQueryAsync(
            _chatMessageContainer!,
            new QueryDefinition("SELECT c.id FROM c WHERE c.userId = @userId AND c.chatId = @chatId")
                .WithParameter("@userId", userId)
                .WithParameter("@chatId", chatId),
            userId);

        await _chatContainer!.DeleteItemAsync<ChatDocument>(chatId, new PartitionKey(userId));
    }

    public async Task UpdateChatAsync(string userId, string chatId, string? newTitle, string? newAssistantId = null)
    {
        await EnsureInitializedAsync();

        if (string.IsNullOrWhiteSpace(newTitle) && string.IsNullOrWhiteSpace(newAssistantId))
        {
            return;
        }

        var patchOperations = new List<PatchOperation>
        {
            PatchOperation.Set("/updatedAt", DateTime.UtcNow)
        };

        if (!string.IsNullOrWhiteSpace(newTitle))
        {
            patchOperations.Add(PatchOperation.Set("/name", newTitle));
        }

        if (!string.IsNullOrWhiteSpace(newAssistantId))
        {
            patchOperations.Add(PatchOperation.Set("/assistantId", newAssistantId));
        }

        try
        {
            await _chatContainer!.PatchItemAsync<ChatDocument>(chatId, new PartitionKey(userId), patchOperations);
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
        }
    }

    // Message management
    public async Task AddMessageAsync(string userId, string chatId, ChatMessage message)
    {
        await EnsureInitializedAsync();

        var messageId = string.IsNullOrWhiteSpace(message.Id) ? Guid.NewGuid().ToString() : message.Id;
        var timestamp = message.Timestamp == default ? DateTime.UtcNow : message.Timestamp;

        var messageDocument = new ChatMessageDocument
        {
            Id = messageId,
            UserId = userId,
            ChatId = chatId,
            Role = message.Role,
            Timestamp = timestamp,
            Status = message.Status,
            ContentBlockIds = await WriteTextContentAsync(userId, chatId, messageId, message.Content),
            Files = await WriteFilesAsync(userId, chatId, message.Files)
        };

        await _chatMessageContainer!.CreateItemAsync(messageDocument, new PartitionKey(userId));

        message.Id = messageId;
        message.Timestamp = timestamp;

        await TouchChatAsync(userId, chatId, timestamp, message.Status);
    }

    public async Task UpdateMessageAsync(string userId, string chatId, ChatMessage message)
    {
        await EnsureInitializedAsync();

        var existingMessage = await ReadItemOrDefaultAsync<ChatMessageDocument>(_chatMessageContainer!, message.Id, userId);

        if (existingMessage == null || existingMessage.ChatId != chatId)
        {
            return;
        }

        var timestamp = message.Timestamp == default ? existingMessage.Timestamp : message.Timestamp;
        var role = message.Role;
        var status = message.Status;

        await DeleteOwnedContentAsync(userId, chatId, message.Id);
        var contentBlockIds = await WriteTextContentAsync(userId, chatId, message.Id, message.Content);

        var files = existingMessage.Files;
        if (message.Files != null && message.Files.Count > 0)
        {
            await DeleteFileContentAsync(userId, chatId, existingMessage.Files);
            files = await WriteFilesAsync(userId, chatId, message.Files);
        }

        var replacement = new ChatMessageDocument
        {
            Id = message.Id,
            UserId = userId,
            ChatId = chatId,
            Role = role,
            Timestamp = timestamp,
            Status = status,
            ContentBlockIds = contentBlockIds,
            Files = files
        };

        await _chatMessageContainer!.ReplaceItemAsync(replacement, replacement.Id, new PartitionKey(userId));

        message.Timestamp = timestamp;
        await TouchChatAsync(userId, chatId, timestamp, status);
    }

    public async Task DeleteMessageAsync(string userId, string chatId, string messageId)
    {
        await EnsureInitializedAsync();

        var existingMessage = await ReadItemOrDefaultAsync<ChatMessageDocument>(_chatMessageContainer!, messageId, userId);

        if (existingMessage == null || existingMessage.ChatId != chatId)
        {
            return;
        }

        await _chatMessageContainer!.DeleteItemAsync<ChatMessageDocument>(messageId, new PartitionKey(userId));

        await DeleteOwnedContentAsync(userId, chatId, messageId);
        if (existingMessage != null)
        {
            await DeleteFileContentAsync(userId, chatId, existingMessage.Files);
        }

        await TouchChatAsync(userId, chatId, DateTime.UtcNow, null);
    }

    private static ChatHeader MapChatHeader(ChatDocument chatDocument)
    {
        return new ChatHeader
        {
            Id = chatDocument.Id,
            AssistantId = chatDocument.AssistantId,
            Name = chatDocument.Name,
            CreatedAt = chatDocument.CreatedAt,
            UpdatedAt = chatDocument.UpdatedAt,
            Status = chatDocument.Status
        };
    }

    private async Task<ChatMessage> MapChatMessageAsync(string userId, ChatMessageDocument messageDocument)
    {
        return new ChatMessage
        {
            Id = messageDocument.Id,
            Role = messageDocument.Role,
            Timestamp = messageDocument.Timestamp,
            Content = await ReadTextContentAsync(userId, messageDocument.ContentBlockIds),
            Status = messageDocument.Status,
            Files = await ReadFilesAsync(userId, messageDocument.Files)
        };
    }

    private async Task<ChatMessage> MapChatMessageAsync(
        string userId,
        ChatMessageDocument messageDocument,
        IReadOnlyDictionary<string, ContentBlockDocument> contentBlocksById)
    {
        return new ChatMessage
        {
            Id = messageDocument.Id,
            Role = messageDocument.Role,
            Timestamp = messageDocument.Timestamp,
            Content = ReadTextContent(messageDocument.ContentBlockIds, contentBlocksById),
            Status = messageDocument.Status,
            Files = await ReadFilesAsync(userId, messageDocument.Files, contentBlocksById)
        };
    }

    private async Task TouchChatAsync(string userId, string chatId, DateTime updatedAt, AiChatStatus? status)
    {
        var patchOperations = new List<PatchOperation>
        {
            PatchOperation.Set("/updatedAt", updatedAt == default ? DateTime.UtcNow : updatedAt)
        };

        if (status.HasValue)
        {
            patchOperations.Add(PatchOperation.Set("/status", status.Value));
        }

        try
        {
            await _chatContainer!.PatchItemAsync<ChatDocument>(chatId, new PartitionKey(userId), patchOperations);
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
        }
    }
}
