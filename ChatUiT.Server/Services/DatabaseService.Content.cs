using ChatUiT.Server.Models;
using Microsoft.Azure.Cosmos;
using System.Text;

namespace ChatUiT.Server.Services;

public partial class DatabaseService
{
    private int MaxTextChunkUtf8Bytes => Math.Min(Math.Max(_options.MaxTextChunkUtf8Bytes, 4_096), 1_000_000);
    private int MaxBinaryPayloadCharacters
    {
        get
        {
            var requestedSize = Math.Min(Math.Max(_options.MaxBinaryPayloadCharacters, 4_096), 1_000_000);
            return requestedSize - (requestedSize % 4);
        }
    }

    private async Task<List<string>> WriteTextContentAsync(string userId, string chatId, string ownerId, string? content, ICollection<string>? writtenBlockIds = null)
    {
        if (_contentContainer == null)
        {
            throw new InvalidOperationException("Content container is not initialized.");
        }

        var chunks = SplitTextPayload(content ?? string.Empty);
        if (chunks.Count == 0)
        {
            return new List<string>();
        }

        var blockIds = new List<string>(chunks.Count);
        for (var index = 0; index < chunks.Count; index++)
        {
            var document = new ContentBlockDocument
            {
                Id = Guid.NewGuid().ToString(),
                UserId = userId,
                ChatId = chatId,
                OwnerId = ownerId,
                ContentType = StoredContentType.Text,
                ChunkIndex = index,
                IsEncrypted = false,
                Payload = chunks[index]
            };

            await _contentContainer.CreateItemAsync(document, new Microsoft.Azure.Cosmos.PartitionKey(userId));
            blockIds.Add(document.Id);
            writtenBlockIds?.Add(document.Id);
        }

        return blockIds;
    }

    private async Task<List<string>> WriteBinaryContentAsync(string userId, string chatId, string ownerId, byte[] bytes, ICollection<string>? writtenBlockIds = null)
    {
        if (_contentContainer == null)
        {
            throw new InvalidOperationException("Content container is not initialized.");
        }

        if (bytes.Length == 0)
        {
            return new List<string>();
        }

        var base64Payload = Convert.ToBase64String(bytes);
        var chunks = SplitBinaryPayload(base64Payload);
        var blockIds = new List<string>(chunks.Count);

        for (var index = 0; index < chunks.Count; index++)
        {
            var document = new ContentBlockDocument
            {
                Id = Guid.NewGuid().ToString(),
                UserId = userId,
                ChatId = chatId,
                OwnerId = ownerId,
                ContentType = StoredContentType.Binary,
                ChunkIndex = index,
                IsEncrypted = false,
                Payload = chunks[index]
            };

            await _contentContainer.CreateItemAsync(document, new Microsoft.Azure.Cosmos.PartitionKey(userId));
            blockIds.Add(document.Id);
            writtenBlockIds?.Add(document.Id);
        }

        return blockIds;
    }

    private async Task<List<StoredFileDocument>> WriteFilesAsync(string userId, string chatId, IReadOnlyCollection<ChatFile>? files, ICollection<string>? writtenBlockIds = null)
    {
        if (files == null || files.Count == 0)
        {
            return new List<StoredFileDocument>();
        }

        var storedFiles = new List<StoredFileDocument>(files.Count);
        foreach (var file in files)
        {
            var storedFile = new StoredFileDocument
            {
                Id = string.IsNullOrWhiteSpace(file.Id) ? Guid.NewGuid().ToString() : file.Id,
                SourceFilename = file.SourceFilename,
                Chunks = new List<StoredFileChunkDocument>()
            };

            foreach (var chunk in file.Chunks)
            {
                var storedChunk = new StoredFileChunkDocument
                {
                    Id = string.IsNullOrWhiteSpace(chunk.Id) ? Guid.NewGuid().ToString() : chunk.Id,
                    Type = chunk.Type,
                    Format = chunk.Format,
                    ContentBlockIds = new List<string>()
                };

                if (chunk.Type.Equals("text", StringComparison.OrdinalIgnoreCase))
                {
                    storedChunk.ContentBlockIds = await WriteTextContentAsync(userId, chatId, storedChunk.Id, chunk.Text, writtenBlockIds);
                }
                else if (chunk.Type.Equals("image", StringComparison.OrdinalIgnoreCase))
                {
                    var imageBytes = string.IsNullOrWhiteSpace(chunk.Base64)
                        ? Array.Empty<byte>()
                        : Convert.FromBase64String(chunk.Base64);
                    storedChunk.ContentBlockIds = await WriteBinaryContentAsync(userId, chatId, storedChunk.Id, imageBytes, writtenBlockIds);
                }

                storedFile.Chunks.Add(storedChunk);
            }

            storedFiles.Add(storedFile);
        }

        return storedFiles;
    }

    private List<ChatFile> ReadFiles(
        IReadOnlyCollection<StoredFileDocument>? files,
        IReadOnlyDictionary<string, ContentBlockDocument> contentBlocksById,
        bool includeContent)
    {
        if (files == null || files.Count == 0)
        {
            return new List<ChatFile>();
        }

        var chatFiles = new List<ChatFile>(files.Count);
        foreach (var file in files)
        {
            var chatFile = new ChatFile
            {
                Id = file.Id,
                SourceFilename = file.SourceFilename,
                Chunks = new List<ChatFileChunk>()
            };

            foreach (var chunk in file.Chunks)
            {
                var chatChunk = new ChatFileChunk
                {
                    Id = chunk.Id,
                    Type = chunk.Type,
                    Format = chunk.Format
                };

                if (includeContent)
                {
                    if (chunk.Type.Equals("text", StringComparison.OrdinalIgnoreCase))
                    {
                        chatChunk.Text = ReadTextContent(chunk.ContentBlockIds, contentBlocksById);
                    }
                    else if (chunk.Type.Equals("image", StringComparison.OrdinalIgnoreCase))
                    {
                        chatChunk.Base64 = Convert.ToBase64String(ReadBinaryContent(chunk.ContentBlockIds, contentBlocksById));
                    }
                }

                chatFile.Chunks.Add(chatChunk);
            }

            chatFiles.Add(chatFile);
        }

        return chatFiles;
    }

    private string ReadTextContent(
        IReadOnlyCollection<string> contentBlockIds,
        IReadOnlyDictionary<string, ContentBlockDocument> contentBlocksById)
    {
        if (contentBlockIds.Count == 0)
        {
            return string.Empty;
        }

        var documents = GetOrderedContentBlocks(contentBlockIds, contentBlocksById);
        if (documents.Count == 0)
        {
            return string.Empty;
        }

        if (documents.Any(x => x.IsEncrypted))
        {
            throw new NotSupportedException("Encrypted text content is not implemented yet.");
        }

        return string.Concat(documents.Select(x => x.Payload));
    }

    private byte[] ReadBinaryContent(
        IReadOnlyCollection<string> contentBlockIds,
        IReadOnlyDictionary<string, ContentBlockDocument> contentBlocksById)
    {
        if (contentBlockIds.Count == 0)
        {
            return Array.Empty<byte>();
        }

        var documents = GetOrderedContentBlocks(contentBlockIds, contentBlocksById);
        if (documents.Count == 0)
        {
            return Array.Empty<byte>();
        }

        return Convert.FromBase64String(string.Concat(documents.Select(x => x.Payload)));
    }

    private List<ContentBlockDocument> GetOrderedContentBlocks(
        IReadOnlyCollection<string> contentBlockIds,
        IReadOnlyDictionary<string, ContentBlockDocument> contentBlocksById)
    {
        var documents = new List<ContentBlockDocument>(contentBlockIds.Count);

        foreach (var contentBlockId in contentBlockIds)
        {
            if (contentBlocksById.TryGetValue(contentBlockId, out var document))
            {
                documents.Add(document);
            }
        }

        return documents;
    }

    private async Task<Dictionary<string, ContentBlockDocument>> ReadContentBlockMapByChatAsync(string userId, string chatId)
    {
        if (_contentContainer == null)
        {
            return new Dictionary<string, ContentBlockDocument>();
        }

        var documents = await QueryItemsAsync<ContentBlockDocument>(
            _contentContainer,
            new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId AND c.chatId = @chatId")
                .WithParameter("@userId", userId)
                .WithParameter("@chatId", chatId),
            userId);

        return documents.ToDictionary(document => document.Id, document => document);
    }

    private async Task<Dictionary<string, ContentBlockDocument>> ReadContentBlockMapByOwnersAsync(
        string userId,
        string chatId,
        IReadOnlyCollection<string> ownerIds)
    {
        if (_contentContainer == null || ownerIds.Count == 0)
        {
            return new Dictionary<string, ContentBlockDocument>();
        }

        var documents = await QueryItemsAsync<ContentBlockDocument>(
            _contentContainer,
            new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId AND c.chatId = @chatId AND ARRAY_CONTAINS(@ownerIds, c.ownerId)")
                .WithParameter("@userId", userId)
                .WithParameter("@chatId", chatId)
                .WithParameter("@ownerIds", ownerIds),
            userId);

        return documents.ToDictionary(document => document.Id, document => document);
    }

    private List<string> SplitTextPayload(string text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return new List<string>();
        }

        var chunks = new List<string>();
        var builder = new StringBuilder();
        var currentBytes = 0;

        foreach (var rune in text.EnumerateRunes())
        {
            var value = rune.ToString();
            var runeBytes = Encoding.UTF8.GetByteCount(value);

            if (builder.Length > 0 && currentBytes + runeBytes > MaxTextChunkUtf8Bytes)
            {
                chunks.Add(builder.ToString());
                builder.Clear();
                currentBytes = 0;
            }

            builder.Append(value);
            currentBytes += runeBytes;
        }

        if (builder.Length > 0)
        {
            chunks.Add(builder.ToString());
        }

        return chunks;
    }

    private List<string> SplitBinaryPayload(string base64Payload)
    {
        if (string.IsNullOrEmpty(base64Payload))
        {
            return new List<string>();
        }

        var chunkSize = MaxBinaryPayloadCharacters;
        var chunks = new List<string>();

        for (var index = 0; index < base64Payload.Length; index += chunkSize)
        {
            chunks.Add(base64Payload.Substring(index, Math.Min(chunkSize, base64Payload.Length - index)));
        }

        return chunks;
    }

    private async Task DeleteContentBlocksAsync(string userId, IEnumerable<string> contentBlockIds)
    {
        if (_contentContainer == null)
        {
            return;
        }

        foreach (var contentBlockId in contentBlockIds.Distinct())
        {
            try
            {
                await _contentContainer.DeleteItemAsync<ContentBlockDocument>(contentBlockId, new PartitionKey(userId));
            }
            catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
            }
        }
    }

    private static List<string> CollectFileContentBlockIds(IReadOnlyCollection<StoredFileDocument>? files)
    {
        var blockIds = new List<string>();
        if (files == null)
        {
            return blockIds;
        }

        foreach (var file in files)
        {
            foreach (var chunk in file.Chunks)
            {
                blockIds.AddRange(chunk.ContentBlockIds);
            }
        }

        return blockIds;
    }

    private async Task DeleteChatContentAsync(string userId, string chatId)
    {
        if (_contentContainer == null)
        {
            return;
        }

        await DeleteItemsByQueryAsync(
            _contentContainer,
            new Microsoft.Azure.Cosmos.QueryDefinition("SELECT c.id FROM c WHERE c.userId = @userId AND c.chatId = @chatId")
                .WithParameter("@userId", userId)
                .WithParameter("@chatId", chatId),
            userId);
    }

    private async Task DeleteOwnedContentAsync(string userId, string chatId, string ownerId)
    {
        if (_contentContainer == null)
        {
            return;
        }

        await DeleteItemsByQueryAsync(
            _contentContainer,
            new Microsoft.Azure.Cosmos.QueryDefinition("SELECT c.id FROM c WHERE c.userId = @userId AND c.chatId = @chatId AND c.ownerId = @ownerId")
                .WithParameter("@userId", userId)
                .WithParameter("@chatId", chatId)
                .WithParameter("@ownerId", ownerId),
            userId);
    }

    private async Task DeleteFileContentAsync(string userId, string contentOwnerChatId, IReadOnlyCollection<StoredFileDocument>? files)
    {
        if (_contentContainer == null || files == null || files.Count == 0)
        {
            return;
        }

        var ownerIds = new HashSet<string>();
        CollectFileOwnerIds(files, ownerIds);

        if (ownerIds.Count == 0)
        {
            return;
        }

        foreach (var ownerId in ownerIds)
        {
            await DeleteOwnedContentAsync(userId, contentOwnerChatId, ownerId);
        }
    }

    private void CollectFileOwnerIds(IReadOnlyCollection<StoredFileDocument> files, ISet<string> ownerIds)
    {
        foreach (var file in files)
        {
            foreach (var chunk in file.Chunks)
            {
                if (!string.IsNullOrWhiteSpace(chunk.Id))
                {
                    ownerIds.Add(chunk.Id);
                }
            }
        }
    }
}
