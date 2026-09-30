using System.Net;
using ChatUitReact.Server.Services.ApiCatalog;
using Microsoft.Azure.Cosmos;

namespace ChatUitReact.Server.Services;

public partial class DatabaseService
{
    public async Task<List<ApiCatalogEntry>> GetApiCatalogEntriesAsync()
    {
        await EnsureInitializedAsync();

        var query = new QueryDefinition("SELECT * FROM c");
        var documents = await QueryItemsAsync<ApiCatalogEntryDocument>(_apiCatalogContainer!, query, ConfigurationPartitionKey);
        return documents.Select(MapApiCatalogEntry).ToList();
    }

    public async Task UpsertApiCatalogEntryAsync(ApiCatalogEntry entry)
    {
        await EnsureInitializedAsync();

        var document = new ApiCatalogEntryDocument
        {
            Id = entry.PublicId,
            PartitionKey = ConfigurationPartitionKeyValue,
            Kind = entry.Kind,
            TargetId = entry.TargetId,
            Enabled = entry.Enabled,
            AllowedRoles = entry.AllowedRoles.ToList(),
            AllowedGroupIds = entry.AllowedGroupIds.ToList(),
            UpdatedAt = entry.UpdatedAt
        };

        await _apiCatalogContainer!.UpsertItemAsync(document, new PartitionKey(ConfigurationPartitionKey));
    }

    public async Task<bool> DeleteApiCatalogEntryAsync(string publicId)
    {
        await EnsureInitializedAsync();

        try
        {
            await _apiCatalogContainer!.DeleteItemAsync<ApiCatalogEntryDocument>(publicId, new PartitionKey(ConfigurationPartitionKey));
            return true;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return false;
        }
    }

    private static ApiCatalogEntry MapApiCatalogEntry(ApiCatalogEntryDocument document) => new()
    {
        PublicId = document.Id,
        Kind = document.Kind,
        TargetId = document.TargetId,
        Enabled = document.Enabled,
        AllowedRoles = document.AllowedRoles,
        AllowedGroupIds = document.AllowedGroupIds,
        UpdatedAt = document.UpdatedAt
    };
}
