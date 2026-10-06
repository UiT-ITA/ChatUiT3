using ChatUitReact.Server.Services.Agents;
using Microsoft.Azure.Cosmos;

namespace ChatUitReact.Server.Services;

public partial class DatabaseService
{
    public async Task<List<InternalAgentSetting>> GetInternalAgentSettingsAsync()
    {
        await EnsureInitializedAsync();

        var query = new QueryDefinition("SELECT * FROM c");
        var documents = await QueryItemsAsync<InternalAgentSettingDocument>(_internalAgentsContainer!, query, ConfigurationPartitionKey);
        return documents.Select(document => new InternalAgentSetting(document.Id, document.ModelId, document.ReasoningEffort, document.ExposedInApi, document.UpdatedAt)).ToList();
    }

    public async Task UpsertInternalAgentSettingAsync(InternalAgentSetting setting)
    {
        await EnsureInitializedAsync();

        var document = new InternalAgentSettingDocument
        {
            Id = setting.AgentId,
            PartitionKey = ConfigurationPartitionKeyValue,
            ModelId = setting.ModelId,
            ReasoningEffort = setting.ReasoningEffort,
            ExposedInApi = setting.ExposedInApi,
            UpdatedAt = setting.UpdatedAt
        };

        await _internalAgentsContainer!.UpsertItemAsync(document, new PartitionKey(ConfigurationPartitionKey));
    }
}
