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

    public async Task<Assistant?> GetAssistantByIdAsync(string assistantId)
    {
        await EnsureInitializedAsync();

        var document = await ReadItemOrDefaultAsync<AssistantDocument>(
            _assistantContainer!,
            assistantId,
            ConfigurationPartitionKey);

        return document == null ? null : await MapAssistantAsync(document);
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

        var document = MapAssistantDocument(assistant, assistant.Id);
        await _assistantContainer!.ReplaceItemAsync(document, document.Id, new PartitionKey(ConfigurationPartitionKey));
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

    private async Task<Assistant> MapAssistantAsync(AssistantDocument document)
    {
        var model = string.IsNullOrWhiteSpace(document.ChatSettings.ModelId)
            ? new Model()
            : await GetModelByIdAsync(document.ChatSettings.ModelId) ?? new Model { Id = document.ChatSettings.ModelId };

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
