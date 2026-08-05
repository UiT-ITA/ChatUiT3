using ChatUitReact.Server.Models;
using Microsoft.Azure.Cosmos;

namespace ChatUitReact.Server.Services;

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

        var file = document?.Files.FirstOrDefault(f => f.Id == fileId);
        if (file == null)
        {
            return null;
        }

        var contentBlocksById = await ReadAssistantContentBlockMapAsync(assistantId);
        return ReadAssistantFiles(new[] { file }, contentBlocksById, includeContent: true).FirstOrDefault();
    }

    public async Task<Assistant> CreateAssistantAsync(Assistant assistant)
    {
        await EnsureInitializedAsync();

        var assistantId = string.IsNullOrWhiteSpace(assistant.Id) ? Guid.NewGuid().ToString() : assistant.Id;
        var document = MapAssistantDocument(assistant, assistantId);

        var writtenBlockIds = new List<string>();
        try
        {
            foreach (var file in assistant.Files)
            {
                document.Files.Add(await WriteAssistantFileAsync(assistantId, file, writtenBlockIds));
            }

            await _assistantContainer!.CreateItemAsync(document, new PartitionKey(ConfigurationPartitionKey));
        }
        catch
        {
            await DeleteAssistantContentBlocksAsync(assistantId, writtenBlockIds);
            throw;
        }

        assistant.Id = assistantId;
        return await MapAssistantAsync(document, includeFileContent: false);
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

        // assistant.Files is the full desired list. A file whose chunks carry no
        // content refers to an already-stored file and is kept (category/description
        // may still change); files with content are written fresh. Old blocks are
        // only deleted after the document is safely replaced.
        var writtenBlockIds = new List<string>();
        var replacedFiles = new List<StoredAssistantFileDocument>();
        try
        {
            foreach (var file in assistant.Files)
            {
                var hasContent = file.Chunks.Any(chunk => chunk.Text != null || chunk.Base64 != null);

                if (!hasContent && !string.IsNullOrWhiteSpace(file.Id) && existingFilesById.TryGetValue(file.Id, out var keptFile))
                {
                    keptFile.Category = file.Category;
                    keptFile.Description = file.Description;
                    document.Files.Add(keptFile);
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(file.Id) && existingFilesById.TryGetValue(file.Id, out var replacedFile))
                {
                    replacedFiles.Add(replacedFile);
                }

                document.Files.Add(await WriteAssistantFileAsync(assistant.Id, file, writtenBlockIds));
            }

            await _assistantContainer!.ReplaceItemAsync(document, document.Id, new PartitionKey(ConfigurationPartitionKey));
        }
        catch
        {
            await DeleteAssistantContentBlocksAsync(assistant.Id, writtenBlockIds);
            throw;
        }

        var keptFileIds = document.Files.Select(f => f.Id).ToHashSet();
        var obsoleteFiles = existingDocument.Files
            .Where(f => !keptFileIds.Contains(f.Id))
            .Concat(replacedFiles)
            .ToList();
        await DeleteAssistantContentBlocksAsync(assistant.Id, CollectAssistantFileContentBlockIds(obsoleteFiles));

        return await MapAssistantAsync(document, includeFileContent: false);
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
            ? new Model()
            : await GetModelByIdAsync(document.ChatSettings.ModelId) ?? new Model { Id = document.ChatSettings.ModelId };

        var contentBlocksById = includeFileContent && document.Files.Count > 0
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
                Temperature = document.ChatSettings.Temperature,
                ReasoningEffort = document.ChatSettings.ReasoningEffort,
                AvailableToolIds = document.ChatSettings.AvailableToolIds
            },
            Files = ReadAssistantFiles(document.Files, contentBlocksById, includeFileContent),
            OwnerId = document.OwnerId
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
                Temperature = assistant.ChatSettings.Temperature,
                ReasoningEffort = assistant.ChatSettings.ReasoningEffort,
                AvailableToolIds = assistant.ChatSettings.AvailableToolIds
            },
            OwnerId = assistant.OwnerId
        };
    }

}
