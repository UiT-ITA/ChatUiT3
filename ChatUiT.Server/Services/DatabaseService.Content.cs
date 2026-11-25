using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Encryption;
using ChatUiT.Server.Services.TokenCounting;
using Microsoft.Azure.Cosmos;
using Newtonsoft.Json.Linq;
using System.Security.Cryptography;
using System.Text;

namespace ChatUiT.Server.Services;

public partial class DatabaseService
{
    private int MaxTextChunkUtf8Bytes => Math.Min(Math.Max(_options.MaxTextChunkUtf8Bytes, 4_096), 1_000_000);
    private async Task<List<string>> WriteTextContentAsync(string userId, string chatId, string ownerId, string? content, byte[]? key, ICollection<string>? writtenBlockIds = null)
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
                IsEncrypted = key != null,
                Payload = key == null ? chunks[index] : ChatContentCipher.Encrypt(key, Encoding.UTF8.GetBytes(chunks[index]))
            };

            await _contentContainer.CreateItemAsync(document, new Microsoft.Azure.Cosmos.PartitionKey(userId));
            blockIds.Add(document.Id);
            writtenBlockIds?.Add(document.Id);
        }

        return blockIds;
    }

    /// <summary>
    /// Whether a stored file entry is a file in the database: its chunks have content blocks, or
    /// it has no content type, as a file in the database without chunks. Every other entry is a
    /// <see cref="ChatFile"/> in Blob Storage.
    /// </summary>
    private static bool IsDatabaseFile(JObject entry)
        => (entry["chunks"] is JArray chunks && chunks.OfType<JObject>().Any(chunk => chunk.ContainsKey("contentBlockIds")))
            || string.IsNullOrEmpty((string?)entry["contentType"]);

    /// <summary>The files of a message. A file in the database gets its content when <paramref name="includeDatabaseContent"/>.</summary>
    private List<ChatFile> ReadFiles(
        IReadOnlyCollection<JObject>? entries,
        IReadOnlyDictionary<string, ContentBlockDocument> contentBlocksById,
        bool includeDatabaseContent,
        byte[]? key)
    {
        if (entries == null || entries.Count == 0)
        {
            return new List<ChatFile>();
        }

        var files = new List<ChatFile>(entries.Count);
        foreach (var entry in entries)
        {
            if (!IsDatabaseFile(entry))
            {
                files.Add(entry.ToObject<ChatFile>()!);
                continue;
            }

            var stored = entry.ToObject<StoredFileDocument>()!;
            files.Add(new ChatFile
            {
                Id = stored.Id,
                SourceFilename = stored.SourceFilename,
                Chunks = ReadChunks(stored.Chunks, contentBlocksById, includeDatabaseContent, key)
            });
        }

        return files;
    }

    /// <summary>The parts of a file in the database. A part gets its text or image bytes when <paramref name="includeContent"/>.</summary>
    private List<ChatFileChunk> ReadChunks(
        IReadOnlyCollection<StoredFileChunkDocument> chunks,
        IReadOnlyDictionary<string, ContentBlockDocument> contentBlocksById,
        bool includeContent,
        byte[]? key)
    {
        var result = new List<ChatFileChunk>(chunks.Count);
        foreach (var chunk in chunks)
        {
            var chatChunk = new ChatFileChunk { Id = chunk.Id, Type = chunk.Type };
            if (chatChunk.IsImage)
            {
                chatChunk.MediaType = MessageParts.ResolveMediaType(chunk.Format);
            }

            if (includeContent && chatChunk.IsText)
            {
                chatChunk.Text = ReadTextContent(chunk.ContentBlockIds, contentBlocksById, key);
            }
            else if (includeContent && chatChunk.IsImage)
            {
                chatChunk.Data = ReadBinaryContent(chunk.ContentBlockIds, contentBlocksById, key);
            }

            result.Add(chatChunk);
        }

        return result;
    }

    /// <summary>The files among <paramref name="entries"/> that are in Blob Storage.</summary>
    private static List<T> BlobFiles<T>(IEnumerable<JObject> entries) where T : ChatFile
        => entries.Where(entry => !IsDatabaseFile(entry)).Select(entry => entry.ToObject<T>()!).ToList();

    private string ReadTextContent(
        IReadOnlyCollection<string> contentBlockIds,
        IReadOnlyDictionary<string, ContentBlockDocument> contentBlocksById,
        byte[]? key = null)
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

        var parts = new List<string>(documents.Count);
        foreach (var document in documents)
        {
            if (!document.IsEncrypted)
            {
                parts.Add(document.Payload);
                continue;
            }

            var bytes = TryDecrypt(document, key);
            if (bytes == null)
            {
                return string.Empty;
            }

            parts.Add(Encoding.UTF8.GetString(bytes));
        }

        return string.Concat(parts);
    }

    private byte[] ReadBinaryContent(
        IReadOnlyCollection<string> contentBlockIds,
        IReadOnlyDictionary<string, ContentBlockDocument> contentBlocksById,
        byte[]? key = null)
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

        var parts = new List<byte[]>(documents.Count);
        foreach (var document in documents)
        {
            var bytes = document.IsEncrypted ? TryDecrypt(document, key) : Convert.FromBase64String(document.Payload);
            if (bytes == null)
            {
                return Array.Empty<byte>();
            }

            parts.Add(bytes);
        }

        var result = new byte[parts.Sum(part => part.Length)];
        var offset = 0;
        foreach (var part in parts)
        {
            part.CopyTo(result, offset);
            offset += part.Length;
        }

        return result;
    }

    // Null when the block does not decrypt; the text or image it belongs to then reads as empty.
    private byte[]? TryDecrypt(ContentBlockDocument block, byte[]? key)
    {
        if (key == null)
        {
            throw new InvalidOperationException("Encrypted content was read without the user's key.");
        }

        try
        {
            return ChatContentCipher.Decrypt(key, block.Payload);
        }
        catch (Exception ex) when (ex is CryptographicException or FormatException)
        {
            _telemetry.ContentDecryptFailed(block.Id, ex);
            return null;
        }
    }

    /// <summary>Encrypts the plaintext blocks among <paramref name="blocks"/> in place. Blocks deleted meanwhile are skipped.</summary>
    private async Task EncryptBlocksAsync(string userId, IEnumerable<ContentBlockDocument> blocks, byte[] key)
    {
        foreach (var block in blocks.Where(b => !b.IsEncrypted).ToList())
        {
            var plaintext = block.ContentType == StoredContentType.Text
                ? Encoding.UTF8.GetBytes(block.Payload)
                : Convert.FromBase64String(block.Payload);
            block.Payload = ChatContentCipher.Encrypt(key, plaintext);
            block.IsEncrypted = true;

            try
            {
                await _contentContainer!.ReplaceItemAsync(block, block.Id, new PartitionKey(userId));
            }
            catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
            }
        }
    }

    /// <summary>Encrypts every content block of the chat that is not encrypted yet, one block at a time.</summary>
    private async Task EncryptChatContentAsync(string userId, string chatId, byte[] key)
    {
        var plaintextBlockIds = await QueryItemsAsync<IdOnlyDocument>(
            _contentContainer!,
            new QueryDefinition("SELECT c.id FROM c WHERE c.userId = @userId AND c.chatId = @chatId AND c.isEncrypted = false")
                .WithParameter("@userId", userId)
                .WithParameter("@chatId", chatId),
            userId);

        foreach (var blockId in plaintextBlockIds)
        {
            var block = await ReadItemOrDefaultAsync<ContentBlockDocument>(_contentContainer!, blockId.Id, userId);
            if (block != null)
            {
                await EncryptBlocksAsync(userId, new[] { block }, key);
            }
        }
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

    private async Task DeleteFileContentAsync(string userId, string contentOwnerChatId, IReadOnlyCollection<JObject>? files)
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

    private static void CollectFileOwnerIds(IReadOnlyCollection<JObject> files, ISet<string> ownerIds)
    {
        foreach (var file in files.Where(IsDatabaseFile).Select(entry => entry.ToObject<StoredFileDocument>()!))
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
