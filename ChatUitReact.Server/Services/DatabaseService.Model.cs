using ChatUitReact.Server.Models;
using Microsoft.Azure.Cosmos;

namespace ChatUitReact.Server.Services;

public partial class DatabaseService
{
    // Endpoint management
    public async Task<List<ModelEndpoint>> GetEndpointsAsync()
    {
        await EnsureInitializedAsync();

        var documents = await QueryItemsAsync<ModelEndpointDocument>(
            _modelEndpointContainer!,
            new QueryDefinition("SELECT * FROM c WHERE c.partitionKey = @partitionKey")
                .WithParameter("@partitionKey", ConfigurationPartitionKey),
            ConfigurationPartitionKey);

        return documents.Select(MapModelEndpoint).ToList();
    }

    public async Task<ModelEndpoint?> GetEndpointByIdAsync(string endpointId)
    {
        await EnsureInitializedAsync();

        var document = await ReadItemOrDefaultAsync<ModelEndpointDocument>(
            _modelEndpointContainer!,
            endpointId,
            ConfigurationPartitionKey);

        return document == null ? null : MapModelEndpoint(document);
    }

    public async Task<string> CreateEndpointAsync(ModelEndpoint endpoint)
    {
        await EnsureInitializedAsync();

        var endpointId = string.IsNullOrWhiteSpace(endpoint.Id) ? Guid.NewGuid().ToString() : endpoint.Id;
        var document = MapModelEndpointDocument(endpoint, endpointId);

        await _modelEndpointContainer!.CreateItemAsync(document, new PartitionKey(ConfigurationPartitionKey));

        endpoint.Id = endpointId;
        return endpointId;
    }

    public async Task<bool> UpdateEndpointAsync(ModelEndpoint endpoint)
    {
        await EnsureInitializedAsync();

        if (string.IsNullOrWhiteSpace(endpoint.Id))
        {
            return false;
        }

        var existingDocument = await ReadItemOrDefaultAsync<ModelEndpointDocument>(
            _modelEndpointContainer!,
            endpoint.Id,
            ConfigurationPartitionKey);

        if (existingDocument == null)
        {
            return false;
        }

        var document = MapModelEndpointDocument(endpoint, endpoint.Id);
        await _modelEndpointContainer!.ReplaceItemAsync(document, document.Id, new PartitionKey(ConfigurationPartitionKey));
        return true;
    }

    public async Task<bool> DeleteEndpointAsync(string endpointId)
    {
        await EnsureInitializedAsync();

        var existingDocument = await ReadItemOrDefaultAsync<ModelEndpointDocument>(
            _modelEndpointContainer!,
            endpointId,
            ConfigurationPartitionKey);

        if (existingDocument == null)
        {
            return false;
        }

        await _modelEndpointContainer!.DeleteItemAsync<ModelEndpointDocument>(endpointId, new PartitionKey(ConfigurationPartitionKey));
        return true;
    }

    // Model management
    public async Task<List<Model>> GetModelsAsync()
    {
        await EnsureInitializedAsync();

        var documents = await QueryItemsAsync<ModelDocument>(
            _modelContainer!,
            new QueryDefinition("SELECT * FROM c WHERE c.partitionKey = @partitionKey")
                .WithParameter("@partitionKey", ConfigurationPartitionKey),
            ConfigurationPartitionKey);

        return documents.Select(MapModel).ToList();
    }

    public async Task<Model?> GetModelByIdAsync(string modelId)
    {
        await EnsureInitializedAsync();

        var document = await ReadItemOrDefaultAsync<ModelDocument>(
            _modelContainer!,
            modelId,
            ConfigurationPartitionKey);

        return document == null ? null : MapModel(document);
    }

    public async Task<string> CreateModelAsync(Model model)
    {
        await EnsureInitializedAsync();

        var modelId = string.IsNullOrWhiteSpace(model.Id) ? Guid.NewGuid().ToString() : model.Id;
        var document = MapModelDocument(model, modelId);

        await _modelContainer!.CreateItemAsync(document, new PartitionKey(ConfigurationPartitionKey));

        model.Id = modelId;
        return modelId;
    }

    public async Task<bool> UpdateModelAsync(Model model)
    {
        await EnsureInitializedAsync();

        if (string.IsNullOrWhiteSpace(model.Id))
        {
            return false;
        }

        var existingDocument = await ReadItemOrDefaultAsync<ModelDocument>(
            _modelContainer!,
            model.Id,
            ConfigurationPartitionKey);

        if (existingDocument == null)
        {
            return false;
        }

        var document = MapModelDocument(model, model.Id);
        await _modelContainer!.ReplaceItemAsync(document, document.Id, new PartitionKey(ConfigurationPartitionKey));
        return true;
    }

    public async Task<bool> DeleteModelAsync(string modelId)
    {
        await EnsureInitializedAsync();

        var existingDocument = await ReadItemOrDefaultAsync<ModelDocument>(
            _modelContainer!,
            modelId,
            ConfigurationPartitionKey);

        if (existingDocument == null)
        {
            return false;
        }

        await _modelContainer!.DeleteItemAsync<ModelDocument>(modelId, new PartitionKey(ConfigurationPartitionKey));
        return true;
    }

    private static ModelEndpoint MapModelEndpoint(ModelEndpointDocument document)
    {
        return new ModelEndpoint
        {
            Id = document.Id,
            Url = document.Url,
            ApiKey = document.ApiKey,
            EndpointType = document.EndpointType
        };
    }

    private static ModelEndpointDocument MapModelEndpointDocument(ModelEndpoint endpoint, string endpointId)
    {
        return new ModelEndpointDocument
        {
            Id = endpointId,
            PartitionKey = ConfigurationPartitionKeyValue,
            Url = endpoint.Url,
            ApiKey = endpoint.ApiKey,
            EndpointType = endpoint.EndpointType
        };
    }

    private static Model MapModel(ModelDocument document)
    {
        return new Model
        {
            Id = document.Id,
            ModelId = document.ModelId,
            ModelName = document.ModelName,
            Description = document.Description,
            EndpointId = document.EndpointId,
            AllowedRoles = document.AllowedRoles,
            Capabilities = document.Capabilities
        };
    }

    private static ModelDocument MapModelDocument(Model model, string modelId)
    {
        return new ModelDocument
        {
            Id = modelId,
            PartitionKey = ConfigurationPartitionKeyValue,
            ModelId = model.ModelId,
            ModelName = model.ModelName,
            Description = model.Description,
            EndpointId = model.EndpointId,
            AllowedRoles = model.AllowedRoles,
            Capabilities = model.Capabilities
        };
    }
}
