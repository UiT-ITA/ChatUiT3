using ChatUiT.Server.Models;
using Microsoft.Azure.Cosmos;

namespace ChatUiT.Server.Services;

public partial class DatabaseService
{
    private async Task<List<string>> WriteAssistantTextContentAsync(string assistantId, string ownerId, string? content, ICollection<string>? writtenBlockIds = null)
    {
        if (_assistantContentContainer == null)
        {
            throw new InvalidOperationException("Assistant content container is not initialized.");
        }

        var chunks = SplitTextPayload(content ?? string.Empty);
        if (chunks.Count == 0)
        {
            return new List<string>();
        }

        var blockIds = new List<string>(chunks.Count);
        for (var index = 0; index < chunks.Count; index++)
        {
            var document = new AssistantContentBlockDocument
            {
                Id = Guid.NewGuid().ToString(),
                AssistantId = assistantId,
                OwnerId = ownerId,
                ContentType = StoredContentType.Text,
                ChunkIndex = index,
                IsEncrypted = false,
                Payload = chunks[index]
            };

            await _assistantContentContainer.CreateItemAsync(document, new PartitionKey(assistantId));
            blockIds.Add(document.Id);
            writtenBlockIds?.Add(document.Id);
        }

        return blockIds;
    }

    private async Task<List<string>> WriteAssistantBinaryContentAsync(string assistantId, string ownerId, byte[] bytes, ICollection<string>? writtenBlockIds = null)
    {
        if (_assistantContentContainer == null)
        {
            throw new InvalidOperationException("Assistant content container is not initialized.");
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
            var document = new AssistantContentBlockDocument
            {
                Id = Guid.NewGuid().ToString(),
                AssistantId = assistantId,
                OwnerId = ownerId,
                ContentType = StoredContentType.Binary,
                ChunkIndex = index,
                IsEncrypted = false,
                Payload = chunks[index]
            };

            await _assistantContentContainer.CreateItemAsync(document, new PartitionKey(assistantId));
            blockIds.Add(document.Id);
            writtenBlockIds?.Add(document.Id);
        }

        return blockIds;
    }

    private async Task<StoredAssistantFileDocument> WriteAssistantFileAsync(string assistantId, AssistantFile file, ICollection<string>? writtenBlockIds = null)
    {
        var storedFile = new StoredAssistantFileDocument
        {
            Id = string.IsNullOrWhiteSpace(file.Id) ? Guid.NewGuid().ToString() : file.Id,
            SourceFilename = file.SourceFilename,
            Category = file.Category,
            Description = file.Description,
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
                storedChunk.ContentBlockIds = await WriteAssistantTextContentAsync(assistantId, storedChunk.Id, chunk.Text, writtenBlockIds);
            }
            else if (chunk.Type.Equals("image", StringComparison.OrdinalIgnoreCase))
            {
                var imageBytes = string.IsNullOrWhiteSpace(chunk.Base64)
                    ? Array.Empty<byte>()
                    : Convert.FromBase64String(chunk.Base64);
                storedChunk.ContentBlockIds = await WriteAssistantBinaryContentAsync(assistantId, storedChunk.Id, imageBytes, writtenBlockIds);
            }

            storedFile.Chunks.Add(storedChunk);
        }

        return storedFile;
    }

    private List<AssistantFile> ReadAssistantFiles(
        IReadOnlyCollection<StoredAssistantFileDocument>? files,
        IReadOnlyDictionary<string, ContentBlockDocument> contentBlocksById,
        bool includeContent)
    {
        if (files == null || files.Count == 0)
        {
            return new List<AssistantFile>();
        }

        var assistantFiles = new List<AssistantFile>(files.Count);
        foreach (var file in files)
        {
            var assistantFile = new AssistantFile
            {
                Id = file.Id,
                SourceFilename = file.SourceFilename,
                Category = file.Category,
                Description = file.Description,
                Chunks = new List<ChatFileChunk>()
            };

            foreach (var chunk in file.Chunks)
            {
                var fileChunk = new ChatFileChunk
                {
                    Id = chunk.Id,
                    Type = chunk.Type,
                    Format = chunk.Format
                };

                if (includeContent)
                {
                    if (chunk.Type.Equals("text", StringComparison.OrdinalIgnoreCase))
                    {
                        fileChunk.Text = ReadTextContent(chunk.ContentBlockIds, contentBlocksById);
                    }
                    else if (chunk.Type.Equals("image", StringComparison.OrdinalIgnoreCase))
                    {
                        fileChunk.Base64 = Convert.ToBase64String(ReadBinaryContent(chunk.ContentBlockIds, contentBlocksById));
                    }
                }

                assistantFile.Chunks.Add(fileChunk);
            }

            assistantFiles.Add(assistantFile);
        }

        return assistantFiles;
    }

    private async Task<Dictionary<string, ContentBlockDocument>> ReadAssistantContentBlockMapAsync(string assistantId)
    {
        if (_assistantContentContainer == null)
        {
            return new Dictionary<string, ContentBlockDocument>();
        }

        var documents = await QueryItemsAsync<AssistantContentBlockDocument>(
            _assistantContentContainer,
            new QueryDefinition("SELECT * FROM c WHERE c.assistantId = @assistantId")
                .WithParameter("@assistantId", assistantId),
            assistantId);

        return documents.ToDictionary(
            document => document.Id,
            document => new ContentBlockDocument
            {
                Id = document.Id,
                OwnerId = document.OwnerId,
                ContentType = document.ContentType,
                ChunkIndex = document.ChunkIndex,
                IsEncrypted = document.IsEncrypted,
                Payload = document.Payload
            });
    }

    private async Task DeleteAssistantContentBlocksAsync(string assistantId, IEnumerable<string> contentBlockIds)
    {
        if (_assistantContentContainer == null)
        {
            return;
        }

        foreach (var contentBlockId in contentBlockIds.Distinct())
        {
            try
            {
                await _assistantContentContainer.DeleteItemAsync<AssistantContentBlockDocument>(contentBlockId, new PartitionKey(assistantId));
            }
            catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
            }
        }
    }

    private async Task DeleteAssistantContentAsync(string assistantId)
    {
        if (_assistantContentContainer == null)
        {
            return;
        }

        await DeleteItemsByQueryAsync(
            _assistantContentContainer,
            new QueryDefinition("SELECT c.id FROM c WHERE c.assistantId = @assistantId")
                .WithParameter("@assistantId", assistantId),
            assistantId);
    }

    private static List<string> CollectAssistantFileContentBlockIds(IEnumerable<StoredAssistantFileDocument> files)
    {
        var blockIds = new List<string>();
        foreach (var file in files)
        {
            foreach (var chunk in file.Chunks)
            {
                blockIds.AddRange(chunk.ContentBlockIds);
            }
        }

        return blockIds;
    }
}
