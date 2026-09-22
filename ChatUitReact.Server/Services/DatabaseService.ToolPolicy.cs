using System.Net;
using ChatUitReact.Server.Models;
using Microsoft.Azure.Cosmos;

namespace ChatUitReact.Server.Services;

public partial class DatabaseService
{
    public async Task<List<ToolPolicy>> GetToolPoliciesAsync()
    {
        await EnsureInitializedAsync();

        var query = new QueryDefinition("SELECT * FROM c");
        var documents = await QueryItemsAsync<ToolPolicyDocument>(_toolPolicyContainer!, query, ConfigurationPartitionKey);
        return documents.Select(MapToolPolicy).ToList();
    }

    public async Task UpsertToolPolicyAsync(ToolPolicy policy)
    {
        await EnsureInitializedAsync();

        var document = new ToolPolicyDocument
        {
            Id = policy.ToolId,
            PartitionKey = ConfigurationPartitionKeyValue,
            Enabled = policy.Policy.Enabled,
            AllowedRoles = policy.Policy.AllowedRoles.ToList(),
            AllowedGroupIds = policy.Policy.AllowedGroupIds.ToList(),
            UpdatedAt = policy.UpdatedAt
        };

        await _toolPolicyContainer!.UpsertItemAsync(document, new PartitionKey(ConfigurationPartitionKey));
    }

    public async Task<bool> DeleteToolPolicyAsync(string toolId)
    {
        await EnsureInitializedAsync();

        try
        {
            await _toolPolicyContainer!.DeleteItemAsync<ToolPolicyDocument>(toolId, new PartitionKey(ConfigurationPartitionKey));
            return true;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return false;
        }
    }

    private static ToolPolicy MapToolPolicy(ToolPolicyDocument document) => new()
    {
        ToolId = document.Id,
        Policy = new ToolAccessPolicy
        {
            Enabled = document.Enabled,
            AllowedRoles = document.AllowedRoles,
            AllowedGroupIds = document.AllowedGroupIds
        },
        UpdatedAt = document.UpdatedAt
    };
}
