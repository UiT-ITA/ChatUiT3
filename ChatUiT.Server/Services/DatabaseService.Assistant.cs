using ChatUiT.Server.Models;
using Microsoft.Azure.Cosmos;
using Newtonsoft.Json.Linq;

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

        var entry = document?.Files.FirstOrDefault(f => (string?)f["id"] == fileId);
        if (entry == null)
        {
            return null;
        }

        var contentBlocksById = IsDatabaseFile(entry)
            ? await ReadAssistantContentBlockMapAsync(assistantId)
            : new Dictionary<string, ContentBlockDocument>();
        return ReadAssistantFiles(new[] { entry }, contentBlocksById, includeDatabaseContent: true).Single();
    }

    public async Task<bool> AddAssistantFileAsync(string assistantId, AssistantFile file)
    {
        await EnsureInitializedAsync();

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
            files.Add(JObject.FromObject(file));

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

    public async Task<AssistantUpdate?> UpdateAssistantAsync(Assistant assistant)
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

        var existingFilesById = existingDocument.Files.ToDictionary(f => (string)f["id"]!, f => f);
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

            var entry = (JObject)stored.DeepClone();
            entry["category"] = file.Category;
            entry["description"] = file.Description;
            document.Files.Add(entry);
        }

        await _assistantContainer!.ReplaceItemAsync(document, document.Id, new PartitionKey(ConfigurationPartitionKey));

        var keptFileIds = document.Files.Select(f => (string?)f["id"]).ToHashSet();
        var obsoleteFiles = existingDocument.Files.Where(f => !keptFileIds.Contains((string?)f["id"])).ToList();
        await DeleteAssistantContentBlocksAsync(assistant.Id, CollectAssistantFileContentBlockIds(obsoleteFiles));

        return new AssistantUpdate(await MapAssistantAsync(document), BlobFiles<AssistantFile>(obsoleteFiles));
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

        var includeDatabaseContent = includeFileContent && document.Files.Any(IsDatabaseFile);
        var contentBlocksById = includeDatabaseContent
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
            Files = ReadAssistantFiles(document.Files, contentBlocksById, includeDatabaseContent),
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
