using ChatUiT.Server.Models;
using Microsoft.Azure.Cosmos;
using Newtonsoft.Json.Linq;

namespace ChatUiT.Server.Services;

public partial class DatabaseService
{
    /// <summary>The files of an assistant. A file in the database gets its content when <paramref name="includeDatabaseContent"/>.</summary>
    private List<AssistantFile> ReadAssistantFiles(
        IReadOnlyCollection<JObject>? entries,
        IReadOnlyDictionary<string, ContentBlockDocument> contentBlocksById,
        bool includeDatabaseContent)
    {
        if (entries == null || entries.Count == 0)
        {
            return new List<AssistantFile>();
        }

        var files = new List<AssistantFile>(entries.Count);
        foreach (var entry in entries)
        {
            if (!IsDatabaseFile(entry))
            {
                files.Add(entry.ToObject<AssistantFile>()!);
                continue;
            }

            var stored = entry.ToObject<StoredAssistantFileDocument>()!;
            files.Add(new AssistantFile
            {
                Id = stored.Id,
                SourceFilename = stored.SourceFilename,
                Category = stored.Category,
                Description = stored.Description,
                Chunks = ReadChunks(stored.Chunks, contentBlocksById, includeDatabaseContent, key: null)
            });
        }

        return files;
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

    private static List<string> CollectAssistantFileContentBlockIds(IEnumerable<JObject> files)
    {
        var blockIds = new List<string>();
        foreach (var file in files.Where(IsDatabaseFile).Select(entry => entry.ToObject<StoredAssistantFileDocument>()!))
        {
            foreach (var chunk in file.Chunks)
            {
                blockIds.AddRange(chunk.ContentBlockIds);
            }
        }

        return blockIds;
    }
}
