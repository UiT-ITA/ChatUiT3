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

    public async Task<Chat?> GetChatByIdAsync(string userId, string chatId, bool includeFileContent = true)
    {
        await EnsureInitializedAsync();

        var chatTask = ReadItemOrDefaultAsync<ChatDocument>(_chatContainer!, chatId, userId);
        var messageDocumentsTask = QueryItemsAsync<ChatMessageDocument>(
            _chatMessageContainer!,
            new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId AND c.chatId = @chatId ORDER BY c.timestamp ASC")
                .WithParameter("@userId", userId)
                .WithParameter("@chatId", chatId),
            userId);

        await Task.WhenAll(chatTask, messageDocumentsTask);

        var chatDocument = await chatTask;

        if (chatDocument == null)
        {
            return null;
        }

        var messageDocuments = await messageDocumentsTask;

        // With file content the whole chat's blocks are needed; without it only the
        // blocks holding message text (owned by the messages themselves) are fetched,
        // so file payloads never leave the database.
        var contentBlocksById = includeFileContent
            ? await ReadContentBlockMapByChatAsync(userId, chatId)
            : await ReadContentBlockMapByOwnersAsync(userId, chatId, messageDocuments.Select(m => m.Id).ToList());

        var messages = new List<ChatMessage>(messageDocuments.Count);
        foreach (var messageDocument in messageDocuments)
        {
            messages.Add(MapChatMessage(messageDocument, contentBlocksById, includeFileContent));
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

    public async Task<ChatFile?> GetChatFileAsync(string userId, string chatId, string fileId)
    {
        await EnsureInitializedAsync();

        var fileDocuments = await QueryItemsAsync<ChatMessageDocument>(
            _chatMessageContainer!,
            new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId AND c.chatId = @chatId")
                .WithParameter("@userId", userId)
                .WithParameter("@chatId", chatId),
            userId);

        var file = fileDocuments
            .SelectMany(message => message.Files)
            .FirstOrDefault(f => f.Id == fileId);

        if (file == null)
        {
            return null;
        }

        var ownerIds = file.Chunks.Select(chunk => chunk.Id).ToList();
        var contentBlocksById = await ReadContentBlockMapByOwnersAsync(userId, chatId, ownerIds);

        return ReadFiles(new[] { file }, contentBlocksById, includeContent: true).FirstOrDefault();
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

        // Content blocks are written before the message document so a partially saved
        // message is never visible; on failure the already-written blocks are removed.
        var writtenBlockIds = new List<string>();
        try
        {
            var messageDocument = new ChatMessageDocument
            {
                Id = messageId,
                UserId = userId,
                ChatId = chatId,
                Role = message.Role,
                Timestamp = timestamp,
                Status = message.Status,
                ContentBlockIds = await WriteTextContentAsync(userId, chatId, messageId, message.Content, writtenBlockIds),
                Files = await WriteFilesAsync(userId, chatId, message.Files, writtenBlockIds)
            };

            await _chatMessageContainer!.CreateItemAsync(messageDocument, new PartitionKey(userId));
        }
        catch
        {
            await DeleteContentBlocksAsync(userId, writtenBlockIds);
            throw;
        }

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
        var replaceFiles = message.Files != null && message.Files.Count > 0;

        // Write the new blocks and replace the message document first; the old blocks
        // are only deleted once the replacement is safely stored. On failure the new
        // blocks are removed and the existing message stays intact.
        var writtenBlockIds = new List<string>();
        try
        {
            var contentBlockIds = await WriteTextContentAsync(userId, chatId, message.Id, message.Content, writtenBlockIds);

            var files = existingMessage.Files;
            if (replaceFiles)
            {
                files = await WriteFilesAsync(userId, chatId, message.Files, writtenBlockIds);
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
        }
        catch
        {
            await DeleteContentBlocksAsync(userId, writtenBlockIds);
            throw;
        }

        await DeleteContentBlocksAsync(userId, existingMessage.ContentBlockIds);
        if (replaceFiles)
        {
            await DeleteContentBlocksAsync(userId, CollectFileContentBlockIds(existingMessage.Files));
        }

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

    private ChatMessage MapChatMessage(
        ChatMessageDocument messageDocument,
        IReadOnlyDictionary<string, ContentBlockDocument> contentBlocksById,
        bool includeFileContent)
    {
        return new ChatMessage
        {
            Id = messageDocument.Id,
            Role = messageDocument.Role,
            Timestamp = messageDocument.Timestamp,
            Content = ReadTextContent(messageDocument.ContentBlockIds, contentBlocksById),
            Status = messageDocument.Status,
            Files = ReadFiles(messageDocument.Files, contentBlocksById, includeFileContent)
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
