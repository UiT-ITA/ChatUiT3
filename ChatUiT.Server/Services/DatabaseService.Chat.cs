using ChatUiT.Server.Models;
using Microsoft.Azure.Cosmos;

namespace ChatUiT.Server.Services;

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

    public async Task<ChatHeader?> GetChatHeaderAsync(string userId, string chatId)
    {
        await EnsureInitializedAsync();

        var chatDocument = await ReadItemOrDefaultAsync<ChatDocument>(_chatContainer!, chatId, userId);
        return chatDocument == null ? null : MapChatHeader(chatDocument);
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

        var key = await GetContentKeyAsync(userId, chatDocument);
        if (key != null)
        {
            await EncryptBlocksAsync(userId, contentBlocksById.Values, key);
        }

        var messages = new List<ChatMessage>(messageDocuments.Count);
        foreach (var messageDocument in messageDocuments)
        {
            messages.Add(MapChatMessage(messageDocument, contentBlocksById, includeFileContent, key));
        }

        return new Chat
        {
            Id = chatDocument.Id,
            AssistantId = chatDocument.AssistantId,
            Name = chatDocument.Name,
            CreatedAt = chatDocument.CreatedAt,
            UpdatedAt = chatDocument.UpdatedAt,
            Status = chatDocument.Status,
            IsFavorite = chatDocument.IsFavorite,
            RedEnabled = chatDocument.RedEnabled,
            LoadedFiles = MapLoadedFiles(chatDocument.LoadedFiles),
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
        var key = await GetContentKeyAsync(userId, chatId);
        if (key != null)
        {
            await EncryptBlocksAsync(userId, contentBlocksById.Values, key);
        }

        return ReadFiles(new[] { file }, contentBlocksById, includeCosmosContent: true, key).FirstOrDefault();
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
            Status = chat.Status,
            IsFavorite = chat.IsFavorite,
            RedEnabled = chat.RedEnabled,
            LoadedFiles = chat.LoadedFiles.Select(MapLoadedFile).ToList()
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

        try
        {
            await _chatContainer!.DeleteItemAsync<ChatDocument>(chatId, new PartitionKey(userId));
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
        }
    }

    public async Task SetChatFavoriteAsync(string userId, string chatId, bool isFavorite)
    {
        await EnsureInitializedAsync();

        // Favoriting is metadata, not activity — leave updatedAt alone so the chat keeps
        // its place in the list ordering.
        var patchOperations = new List<PatchOperation>
        {
            PatchOperation.Set("/isFavorite", isFavorite)
        };

        try
        {
            await _chatContainer!.PatchItemAsync<ChatDocument>(chatId, new PartitionKey(userId), patchOperations);
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
        }
    }

    public async Task EnableRedAsync(string userId, string chatId, string? assistantId)
    {
        await EnsureInitializedAsync();

        var patchOperations = new List<PatchOperation>
        {
            PatchOperation.Set("/redEnabled", true)
        };

        if (!string.IsNullOrWhiteSpace(assistantId))
        {
            patchOperations.Add(PatchOperation.Set("/assistantId", assistantId));
        }

        try
        {
            await _chatContainer!.PatchItemAsync<ChatDocument>(chatId, new PartitionKey(userId), patchOperations);
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return;
        }

        await EncryptChatContentAsync(userId, chatId, await _chatKeys.GetUserKeyAsync(userId));
    }

    public async Task MarkChatFilesEncryptedAsync(string userId, string chatId)
    {
        await EnsureInitializedAsync();

        var messageDocuments = await QueryItemsAsync<ChatMessageDocument>(
            _chatMessageContainer!,
            new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId AND c.chatId = @chatId AND ARRAY_LENGTH(c.files) > 0")
                .WithParameter("@userId", userId)
                .WithParameter("@chatId", chatId),
            userId);

        foreach (var messageDocument in messageDocuments.Where(m => m.Files.Any(f => f.Blob is { Encrypted: false })))
        {
            await ChangeMessageFilesAsync(userId, chatId, messageDocument.Id, (_, files) =>
            {
                foreach (var file in files.Where(f => f.Blob != null))
                {
                    file.Blob!.Encrypted = true;
                }

                return true;
            });
        }
    }

    public async Task<ChatMessage?> GetMessageAsync(string userId, string chatId, string messageId)
    {
        await EnsureInitializedAsync();

        var messageDocument = await ReadItemOrDefaultAsync<ChatMessageDocument>(_chatMessageContainer!, messageId, userId);
        if (messageDocument == null || messageDocument.ChatId != chatId)
        {
            return null;
        }

        var contentBlocksById = await ReadContentBlockMapByOwnersAsync(userId, chatId, new List<string> { messageId });
        var key = await GetContentKeyAsync(userId, chatId);
        return MapChatMessage(messageDocument, contentBlocksById, includeCosmosFileContent: false, key);
    }

    public async Task<bool> AddMessageFileAsync(string userId, string chatId, string messageId, ChatFile file)
    {
        await EnsureInitializedAsync();

        var key = await GetContentKeyAsync(userId, chatId);

        // The file's content blocks are written before the file is added to the message. When
        // the file is not added, the blocks are deleted.
        var writtenBlockIds = new List<string>();
        try
        {
            var storedFile = new StoredFileDocument { Id = file.Id, SourceFilename = file.SourceFilename };
            foreach (var chunk in file.Chunks)
            {
                var storedChunk = new StoredFileChunkDocument { Id = chunk.Id, Type = chunk.Type, Format = chunk.IsImage ? null : chunk.Format };
                if (chunk.IsText)
                {
                    storedChunk.ContentBlockIds = await WriteTextContentAsync(userId, chatId, storedChunk.Id, chunk.Text, key, writtenBlockIds);
                }
                else if (chunk.IsImage)
                {
                    storedChunk.ContentBlockIds = await WriteBinaryContentAsync(userId, chatId, storedChunk.Id, chunk.Data ?? [], key, writtenBlockIds);
                }

                storedFile.Chunks.Add(storedChunk);
            }

            var added = await ChangeMessageFilesAsync(userId, chatId, messageId, (message, files) =>
            {
                if (message.Status != AiChatStatus.New)
                {
                    return false;
                }

                files.Add(storedFile);
                return true;
            }, touch: true);

            if (!added)
            {
                await DeleteContentBlocksAsync(userId, writtenBlockIds);
            }

            return added;
        }
        catch
        {
            await DeleteContentBlocksAsync(userId, writtenBlockIds);
            throw;
        }
    }

    public async Task<bool> MarkMessageSentAsync(string userId, string chatId, string messageId, DateTime timestamp)
    {
        await EnsureInitializedAsync();

        while (true)
        {
            ItemResponse<ChatMessageDocument> response;
            try
            {
                response = await _chatMessageContainer!.ReadItemAsync<ChatMessageDocument>(messageId, new PartitionKey(userId));
            }
            catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return false;
            }

            if (response.Resource.ChatId != chatId || response.Resource.Status != AiChatStatus.New)
            {
                return false;
            }

            try
            {
                await _chatMessageContainer!.PatchItemAsync<ChatMessageDocument>(
                    messageId,
                    new PartitionKey(userId),
                    new[] { PatchOperation.Set("/status", AiChatStatus.Success), PatchOperation.Set("/timestamp", timestamp) },
                    new PatchItemRequestOptions { IfMatchEtag = response.ETag });
                return true;
            }
            catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.PreconditionFailed)
            {
            }
            catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return false;
            }
        }
    }

    /// <summary>
    /// Changes the files of a message and saves them when <paramref name="change"/> returns true.
    /// Runs again when the message was changed meanwhile. False when the message does not exist
    /// in the chat or nothing was saved. With <paramref name="touch"/> the message's timestamp
    /// is set to now.
    /// </summary>
    private async Task<bool> ChangeMessageFilesAsync(string userId, string chatId, string messageId, Func<ChatMessageDocument, List<StoredFileDocument>, bool> change, bool touch = false)
    {
        while (true)
        {
            ItemResponse<ChatMessageDocument> response;
            try
            {
                response = await _chatMessageContainer!.ReadItemAsync<ChatMessageDocument>(messageId, new PartitionKey(userId));
            }
            catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return false;
            }

            var files = response.Resource.Files;
            if (response.Resource.ChatId != chatId || !change(response.Resource, files))
            {
                return false;
            }

            try
            {
                var operations = new List<PatchOperation> { PatchOperation.Set("/files", files) };
                if (touch)
                {
                    operations.Add(PatchOperation.Set("/timestamp", DateTime.UtcNow));
                }

                await _chatMessageContainer!.PatchItemAsync<ChatMessageDocument>(
                    messageId,
                    new PartitionKey(userId),
                    operations,
                    new PatchItemRequestOptions { IfMatchEtag = response.ETag });
                return true;
            }
            catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.PreconditionFailed)
            {
            }
            catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return false;
            }
        }
    }

    public async Task UpdateChatAsync(string userId, string chatId, string? newTitle, string? newAssistantId = null)
    {
        await EnsureInitializedAsync();

        if (string.IsNullOrWhiteSpace(newTitle) && string.IsNullOrWhiteSpace(newAssistantId))
        {
            return;
        }

        // Renaming is metadata, not activity — updatedAt is maintained by TouchChatAsync on
        // every message write, so it must not be bumped here or a renamed chat would jump
        // to the top of the list.
        var patchOperations = new List<PatchOperation>();

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

        var key = await GetContentKeyAsync(userId, chatId);

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
                ContentBlockIds = await WriteTextContentAsync(userId, chatId, messageId, message.Content, key, writtenBlockIds),
                ActivityBlockIds = await WriteTextContentAsync(userId, chatId, messageId, SerializeActivity(message.Activity), key, writtenBlockIds),
                TranscriptBlockIds = await WriteTextContentAsync(userId, chatId, messageId, SerializeTranscript(message.Transcript), key, writtenBlockIds),
                Files = message.Files.Select(ToMessageFile).ToList(),
                AssistantId = message.AssistantId,
                AssistantName = message.AssistantName,
                TokenCounts = message.TokenCounts ?? new Dictionary<string, int>(),
                FileTokenCounts = message.FileTokenCounts ?? new Dictionary<string, int>()
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

        // A message that waits for its files is not sent yet: the chat keeps its status.
        await TouchChatAsync(userId, chatId, timestamp, message.Status == AiChatStatus.New ? null : message.Status);
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
        var key = await GetContentKeyAsync(userId, chatId);

        // Write the new blocks and replace the message document first; the old blocks
        // are only deleted once the replacement is safely stored. On failure the new
        // blocks are removed and the existing message stays intact. The message keeps
        // the files it has.
        var writtenBlockIds = new List<string>();
        try
        {
            var contentBlockIds = await WriteTextContentAsync(userId, chatId, message.Id, message.Content, key, writtenBlockIds);
            var activityBlockIds = await WriteTextContentAsync(userId, chatId, message.Id, SerializeActivity(message.Activity), key, writtenBlockIds);
            var transcriptBlockIds = await WriteTextContentAsync(userId, chatId, message.Id, SerializeTranscript(message.Transcript), key, writtenBlockIds);

            var replacement = new ChatMessageDocument
            {
                Id = message.Id,
                UserId = userId,
                ChatId = chatId,
                Role = role,
                Timestamp = timestamp,
                Status = status,
                ContentBlockIds = contentBlockIds,
                ActivityBlockIds = activityBlockIds,
                TranscriptBlockIds = transcriptBlockIds,
                Files = existingMessage.Files,
                // A full replace, so anything not carried here is wiped. Callers that build a
                // partial message (the stale-generation fixup, for one) leave these blank.
                AssistantId = string.IsNullOrWhiteSpace(message.AssistantId)
                    ? existingMessage.AssistantId
                    : message.AssistantId,
                AssistantName = string.IsNullOrWhiteSpace(message.AssistantName)
                    ? existingMessage.AssistantName
                    : message.AssistantName,
                TokenCounts = message.TokenCounts is { Count: > 0 }
                    ? message.TokenCounts
                    : existingMessage.TokenCounts,
                FileTokenCounts = message.FileTokenCounts is { Count: > 0 }
                    ? message.FileTokenCounts
                    : existingMessage.FileTokenCounts
            };

            await _chatMessageContainer!.ReplaceItemAsync(replacement, replacement.Id, new PartitionKey(userId));
        }
        catch
        {
            await DeleteContentBlocksAsync(userId, writtenBlockIds);
            throw;
        }

        await DeleteContentBlocksAsync(userId, existingMessage.ContentBlockIds);
        await DeleteContentBlocksAsync(userId, existingMessage.ActivityBlockIds);
        await DeleteContentBlocksAsync(userId, existingMessage.TranscriptBlockIds);
        message.Timestamp = timestamp;
        await TouchChatAsync(userId, chatId, timestamp, status);
    }

    public async Task SetMessageTokenCountsAsync(string userId, string chatId, string messageId, IReadOnlyDictionary<string, int> tokenCounts, IReadOnlyDictionary<string, int> fileTokenCounts)
    {
        await EnsureInitializedAsync();

        var existingMessage = await ReadItemOrDefaultAsync<ChatMessageDocument>(_chatMessageContainer!, messageId, userId);
        if (existingMessage == null || existingMessage.ChatId != chatId)
        {
            return;
        }

        // Counting is not activity: a patch on the message alone, no updatedAt on the chat.
        var patchOperations = new List<PatchOperation>
        {
            PatchOperation.Set("/tokenCounts", tokenCounts),
            PatchOperation.Set("/fileTokenCounts", fileTokenCounts)
        };

        try
        {
            await _chatMessageContainer!.PatchItemAsync<ChatMessageDocument>(messageId, new PartitionKey(userId), patchOperations);
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
        }
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
        await DeleteFileContentAsync(userId, chatId, existingMessage.Files);

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
            Status = chatDocument.Status,
            IsFavorite = chatDocument.IsFavorite,
            RedEnabled = chatDocument.RedEnabled,
            LoadedFiles = MapLoadedFiles(chatDocument.LoadedFiles)
        };
    }

    private static List<ChatLoadedFile> MapLoadedFiles(List<ChatLoadedFileDocument>? documents)
        => (documents ?? new List<ChatLoadedFileDocument>()).Select(d => new ChatLoadedFile
        {
            FileId = d.FileId,
            SourceFilename = d.SourceFilename,
            TokenCounts = new Dictionary<string, int>(d.TokenCounts)
        }).ToList();

    private static ChatLoadedFileDocument MapLoadedFile(ChatLoadedFile file)
        => new()
        {
            FileId = file.FileId,
            SourceFilename = file.SourceFilename,
            TokenCounts = new Dictionary<string, int>(file.TokenCounts)
        };

    public async Task<bool> AddChatLoadedFileAsync(string userId, string chatId, ChatLoadedFile file)
    {
        await EnsureInitializedAsync();

        var document = await ReadItemOrDefaultAsync<ChatDocument>(_chatContainer!, chatId, userId);
        if (document == null)
        {
            return false;
        }

        var files = document.LoadedFiles ?? new List<ChatLoadedFileDocument>();
        if (files.Any(f => f.FileId == file.FileId))
        {
            return true;
        }

        files.Add(MapLoadedFile(file));

        // Pinning is metadata, like renaming: updatedAt stays with the last message write.
        await _chatContainer!.PatchItemAsync<ChatDocument>(
            chatId,
            new PartitionKey(userId),
            new[] { PatchOperation.Set("/loadedFiles", files) });
        return true;
    }

    private ChatMessage MapChatMessage(
        ChatMessageDocument messageDocument,
        IReadOnlyDictionary<string, ContentBlockDocument> contentBlocksById,
        bool includeCosmosFileContent,
        byte[]? key)
    {
        return new ChatMessage
        {
            Id = messageDocument.Id,
            Role = messageDocument.Role,
            Timestamp = messageDocument.Timestamp,
            Content = ReadTextContent(messageDocument.ContentBlockIds, contentBlocksById, key),
            Activity = DeserializeActivity(ReadTextContent(messageDocument.ActivityBlockIds, contentBlocksById, key)),
            Transcript = DeserializeTranscript(ReadTextContent(messageDocument.TranscriptBlockIds, contentBlocksById, key)),
            Status = messageDocument.Status,
            Files = ReadFiles(messageDocument.Files, contentBlocksById, includeCosmosFileContent, key),
            AssistantId = messageDocument.AssistantId,
            AssistantName = messageDocument.AssistantName,
            TokenCounts = messageDocument.TokenCounts ?? new Dictionary<string, int>(),
            FileTokenCounts = messageDocument.FileTokenCounts ?? new Dictionary<string, int>()
        };
    }

    /// <summary>A file as it is stored on a message. Only files in Blob Storage can be added to a message.</summary>
    private static StoredFileDocument ToMessageFile(ChatFile file)
        => file.IsInBlobStorage
            ? ToStoredFile(file)
            : throw new InvalidOperationException($"File {file.Id} is not in Blob Storage and cannot be stored on a message.");

    private static readonly System.Text.Json.JsonSerializerOptions ActivityJsonOptions =
        new(System.Text.Json.JsonSerializerDefaults.Web);

    private static string? SerializeActivity(MessageActivity? activity)
    {
        return activity == null ? null : System.Text.Json.JsonSerializer.Serialize(activity, ActivityJsonOptions);
    }

    private static MessageActivity? DeserializeActivity(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<MessageActivity>(json, ActivityJsonOptions);
        }
        catch (System.Text.Json.JsonException)
        {
            // A corrupt record costs the user the activity panel, not the message.
            return null;
        }
    }

    private static string? SerializeTranscript(List<TranscriptItem>? transcript)
    {
        return transcript is not { Count: > 0 } ? null : System.Text.Json.JsonSerializer.Serialize(transcript, ActivityJsonOptions);
    }

    private static List<TranscriptItem>? DeserializeTranscript(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<List<TranscriptItem>>(json, ActivityJsonOptions);
        }
        catch (System.Text.Json.JsonException)
        {
            // A corrupt record replays the message as text, as messages without a transcript do.
            return null;
        }
    }

    /// <summary>The user's content key when the chat is red, otherwise null.</summary>
    private async Task<byte[]?> GetContentKeyAsync(string userId, string chatId)
        => await GetContentKeyAsync(userId, await ReadItemOrDefaultAsync<ChatDocument>(_chatContainer!, chatId, userId));

    private async Task<byte[]?> GetContentKeyAsync(string userId, ChatDocument? chatDocument)
        => chatDocument is { RedEnabled: true } ? await _chatKeys.GetUserKeyAsync(userId) : null;

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
