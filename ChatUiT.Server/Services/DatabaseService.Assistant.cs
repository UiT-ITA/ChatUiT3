using ChatUiT.Server.Models;
using Microsoft.Azure.Cosmos;

namespace ChatUiT.Server.Services;

public partial class DatabaseService
{
    public async Task<List<Assistant>> GetAssistantsByOwnerAsync(string ownerId)
    {
        await EnsureInitializedAsync();

        var documents = await QueryItemsAsync<AssistantDocument>(
            _assistantContainer!,
            new QueryDefinition("SELECT * FROM c WHERE c.partitionKey = @partitionKey AND c.ownerId = @ownerId")
                .WithParameter("@partitionKey", ConfigurationPartitionKey)
                .WithParameter("@ownerId", ownerId),
            ConfigurationPartitionKey);

        return await MapAssistantsAsync(documents);
    }

    public async Task<List<Assistant>> GetSystemAssistantsAsync()
    {
        await EnsureInitializedAsync();

        var documents = await QueryItemsAsync<AssistantDocument>(
            _assistantContainer!,
            new QueryDefinition("SELECT * FROM c WHERE c.partitionKey = @partitionKey AND c.ownerId = @ownerId")
                .WithParameter("@partitionKey", ConfigurationPartitionKey)
                .WithParameter("@ownerId", "System"),
            ConfigurationPartitionKey);

        return await MapAssistantsAsync(documents);
    }

    public async Task<List<Assistant>> GetAssistantsByIdsAsync(List<string> assistantIds)
    {
        await EnsureInitializedAsync();

        if (assistantIds.Count == 0)
        {
            return new List<Assistant>();
        }

        var assistants = new List<Assistant>(assistantIds.Count);
        foreach (var assistantId in assistantIds.Distinct())
        {
            var document = await ReadItemOrDefaultAsync<AssistantDocument>(
                _assistantContainer!,
                assistantId,
                ConfigurationPartitionKey);

            if (document != null)
            {
                assistants.Add(await MapAssistantAsync(document));
            }
        }

        return assistants;
    }

    public async Task<Assistant?> GetAssistantByIdAsync(string assistantId, bool includeFileContent = false)
    {
        await EnsureInitializedAsync();

        var document = await ReadItemOrDefaultAsync<AssistantDocument>(
            _assistantContainer!,
            assistantId,
            ConfigurationPartitionKey);

        return document == null ? null : await MapAssistantAsync(document, includeFileContent);
    }

    public async Task<AssistantFile?> GetAssistantFileAsync(string assistantId, string fileId)
    {
        await EnsureInitializedAsync();

        var document = await ReadItemOrDefaultAsync<AssistantDocument>(
            _assistantContainer!,
            assistantId,
            ConfigurationPartitionKey);

        var stored = document?.Files.FirstOrDefault(f => f.Id == fileId);
        if (stored == null)
        {
            return null;
        }

        var contentBlocksById = stored.Blob == null
            ? await ReadAssistantContentBlockMapAsync(assistantId)
            : new Dictionary<string, ContentBlockDocument>();
        return ReadAssistantFiles(new[] { stored }, contentBlocksById, includeCosmosContent: true).Single();
    }

    public async Task<bool> AddAssistantFileAsync(string assistantId, AssistantFile file)
    {
        await EnsureInitializedAsync();

        // The file's content blocks are written before the file is added to the assistant. When
        // the file is not added, the blocks are deleted.
        var writtenBlockIds = new List<string>();
        try
        {
            var storedFile = new StoredAssistantFileDocument
            {
                Id = file.Id,
                SourceFilename = file.SourceFilename,
                Category = file.Category,
                Description = file.Description
            };
            foreach (var chunk in file.Chunks)
            {
                var storedChunk = new StoredFileChunkDocument { Id = chunk.Id, Type = chunk.Type, Format = chunk.IsImage ? null : chunk.Format };
                if (chunk.IsText)
                {
                    storedChunk.ContentBlockIds = await WriteAssistantTextContentAsync(assistantId, storedChunk.Id, chunk.Text, writtenBlockIds);
                }
                else if (chunk.IsImage)
                {
                    storedChunk.ContentBlockIds = await WriteAssistantBinaryContentAsync(assistantId, storedChunk.Id, chunk.Data ?? [], writtenBlockIds);
                }

                storedFile.Chunks.Add(storedChunk);
            }

            var added = await AddStoredAssistantFileAsync(assistantId, storedFile);
            if (!added)
            {
                await DeleteAssistantContentBlocksAsync(assistantId, writtenBlockIds);
            }

            return added;
        }
        catch
        {
            await DeleteAssistantContentBlocksAsync(assistantId, writtenBlockIds);
            throw;
        }
    }

    private async Task<bool> AddStoredAssistantFileAsync(string assistantId, StoredAssistantFileDocument storedFile)
    {
        while (true)
        {
            ItemResponse<AssistantDocument> response;
            try
            {
                response = await _assistantContainer!.ReadItemAsync<AssistantDocument>(assistantId, new PartitionKey(ConfigurationPartitionKey));
            }
            catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return false;
            }

            var files = response.Resource.Files;
            files.Add(storedFile);

            try
            {
                await _assistantContainer!.PatchItemAsync<AssistantDocument>(
                    assistantId,
                    new PartitionKey(ConfigurationPartitionKey),
                    new[] { PatchOperation.Set("/files", files), PatchOperation.Set("/updatedAt", DateTime.UtcNow) },
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

    public async Task<Assistant> CreateAssistantAsync(Assistant assistant)
    {
        await EnsureInitializedAsync();

        var assistantId = string.IsNullOrWhiteSpace(assistant.Id) ? Guid.NewGuid().ToString() : assistant.Id;
        var document = MapAssistantDocument(assistant, assistantId);
        await _assistantContainer!.CreateItemAsync(document, new PartitionKey(ConfigurationPartitionKey));

        assistant.Id = assistantId;
        return await MapAssistantAsync(document);
    }

    public async Task<Assistant?> UpdateAssistantAsync(Assistant assistant)
    {
        await EnsureInitializedAsync();

        if (string.IsNullOrWhiteSpace(assistant.Id))
        {
            return null;
        }

        var existingDocument = await ReadItemOrDefaultAsync<AssistantDocument>(
            _assistantContainer!,
            assistant.Id,
            ConfigurationPartitionKey);

        if (existingDocument == null)
        {
            return null;
        }

        var existingFilesById = existingDocument.Files.ToDictionary(f => f.Id, f => f);
        var document = MapAssistantDocument(assistant, assistant.Id);

        // assistant.Files is the full desired list. Each file is one the assistant already
        // has. The content blocks of the files it no longer has are only deleted after the
        // document is safely replaced.
        foreach (var file in assistant.Files)
        {
            if (!existingFilesById.TryGetValue(file.Id, out var stored))
            {
                throw new InvalidOperationException($"File {file.Id} is not a file of assistant {assistant.Id}.");
            }

            stored.Category = file.Category;
            stored.Description = file.Description;
            document.Files.Add(stored);
        }

        await _assistantContainer!.ReplaceItemAsync(document, document.Id, new PartitionKey(ConfigurationPartitionKey));

        var keptFileIds = document.Files.Select(f => f.Id).ToHashSet();
        var obsoleteFiles = existingDocument.Files.Where(f => !keptFileIds.Contains(f.Id)).ToList();
        await DeleteAssistantContentBlocksAsync(assistant.Id, CollectAssistantFileContentBlockIds(obsoleteFiles));

        return await MapAssistantAsync(document);
    }

    public async Task<bool> DeleteAssistantAsync(string assistantId)
    {
        await EnsureInitializedAsync();

        var existingDocument = await ReadItemOrDefaultAsync<AssistantDocument>(
            _assistantContainer!,
            assistantId,
            ConfigurationPartitionKey);

        if (existingDocument == null)
        {
            return false;
        }

        await DeleteAssistantContentAsync(assistantId);
        await _assistantContainer!.DeleteItemAsync<AssistantDocument>(assistantId, new PartitionKey(ConfigurationPartitionKey));
        return true;
    }

    private async Task<List<Assistant>> MapAssistantsAsync(List<AssistantDocument> documents)
    {
        var assistants = new List<Assistant>(documents.Count);

        foreach (var document in documents)
        {
            assistants.Add(await MapAssistantAsync(document));
        }

        return assistants;
    }

    private async Task<Assistant> MapAssistantAsync(AssistantDocument document, bool includeFileContent = false)
    {
        var model = string.IsNullOrWhiteSpace(document.ChatSettings.ModelId)
            ? new LanguageModel()
            : new LanguageModel { Id = document.ChatSettings.ModelId };

        var includeCosmosContent = includeFileContent && document.Files.Any(f => f.Blob == null);
        var contentBlocksById = includeCosmosContent
            ? await ReadAssistantContentBlockMapAsync(document.Id)
            : new Dictionary<string, ContentBlockDocument>();

        return new Assistant
        {
            Id = document.Id,
            Name = document.Name,
            Description = document.Description,
            Tags = document.Tags,
            ChatSettings = new ChatSettings
            {
                SystemPrompt = document.ChatSettings.SystemPrompt,
                Model = model,
                ReasoningEffort = document.ChatSettings.ReasoningEffort,
                AvailableToolIds = document.ChatSettings.AvailableToolIds,
                PromptSnippets = document.ChatSettings.PromptSnippets
            },
            Files = ReadAssistantFiles(document.Files, contentBlocksById, includeCosmosContent),
            KnowledgeSourceIds = document.KnowledgeSourceIds ?? new List<string>(),
            OwnerId = document.OwnerId,
            UpdatedAt = document.UpdatedAt,
            Access = document.Access == null
                ? null
                : new AssistantAccessPolicy { AllowedRoles = document.Access.AllowedRoles, AllowedGroupIds = document.Access.AllowedGroupIds }
        };
    }

    private static AssistantDocument MapAssistantDocument(Assistant assistant, string assistantId)
    {
        return new AssistantDocument
        {
            Id = assistantId,
            PartitionKey = ConfigurationPartitionKeyValue,
            Name = assistant.Name,
            Description = assistant.Description,
            Tags = assistant.Tags,
            ChatSettings = new AssistantChatSettingsDocument
            {
                SystemPrompt = assistant.ChatSettings.SystemPrompt,
                ModelId = assistant.ChatSettings.Model?.Id ?? string.Empty,
                ReasoningEffort = assistant.ChatSettings.ReasoningEffort,
                AvailableToolIds = assistant.ChatSettings.AvailableToolIds,
                PromptSnippets = assistant.ChatSettings.PromptSnippets
            },
            KnowledgeSourceIds = assistant.KnowledgeSourceIds,
            OwnerId = assistant.OwnerId,
            UpdatedAt = DateTime.UtcNow,
            Access = assistant.Access == null
                ? null
                : new AssistantAccessDocument { AllowedRoles = assistant.Access.AllowedRoles, AllowedGroupIds = assistant.Access.AllowedGroupIds }
        };
    }

}
