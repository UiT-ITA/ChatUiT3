using ChatUitReact.Server.Models;
using System.Collections.Concurrent;

namespace ChatUitReact.Server.Services;

public class ModelService : IModelService
{
    private readonly IDatabaseService _databaseService;
    private readonly ConcurrentDictionary<string, ModelEndpoint> _endpoints = new();
    private readonly ConcurrentDictionary<string, Model> _models = new();
    private bool _isInitialized = false;
    private readonly SemaphoreSlim _initLock = new(1, 1);

    public ModelService(IDatabaseService databaseService)
    {
        _databaseService = databaseService;
    }

    private async Task EnsureInitializedAsync()
    {
        if (_isInitialized) return;

        await _initLock.WaitAsync();
        try
        {
            if (_isInitialized) return;

            var endpoints = await _databaseService.GetEndpointsAsync();
            var models = await _databaseService.GetModelsAsync();

            foreach (var endpoint in endpoints)
                _endpoints[endpoint.Id] = endpoint;

            foreach (var model in models)
                _models[model.Id] = model;

            _isInitialized = true;
        }
        finally
        {
            _initLock.Release();
        }
    }

    // Endpoint operations
    public async Task<List<ModelEndpoint>> GetAllEndpointsAsync()
    {
        await EnsureInitializedAsync();
        return _endpoints.Values.ToList();
    }

    public async Task<ModelEndpoint?> GetEndpointByIdAsync(string endpointId)
    {
        await EnsureInitializedAsync();
        _endpoints.TryGetValue(endpointId, out var endpoint);
        return endpoint;
    }

    public async Task<string> CreateEndpointAsync(ModelEndpoint endpoint)
    {
        await EnsureInitializedAsync();
        var id = await _databaseService.CreateEndpointAsync(endpoint);
        endpoint.Id = id;
        _endpoints[id] = endpoint;
        return id;
    }

    public async Task<bool> UpdateEndpointAsync(ModelEndpoint endpoint)
    {
        await EnsureInitializedAsync();
        var success = await _databaseService.UpdateEndpointAsync(endpoint);
        if (success)
            _endpoints[endpoint.Id] = endpoint;
        return success;
    }

    public async Task<bool> DeleteEndpointAsync(string endpointId)
    {
        await EnsureInitializedAsync();
        var success = await _databaseService.DeleteEndpointAsync(endpointId);
        if (success)
            _endpoints.TryRemove(endpointId, out _);
        return success;
    }

    // Model operations
    public async Task<List<Model>> GetAllModelsAsync()
    {
        await EnsureInitializedAsync();
        return _models.Values.ToList();
    }

    public async Task<Model?> GetModelByIdAsync(string modelId)
    {
        await EnsureInitializedAsync();
        _models.TryGetValue(modelId, out var model);
        return model;
    }

    public async Task<string> CreateModelAsync(Model model)
    {
        await EnsureInitializedAsync();
        var id = await _databaseService.CreateModelAsync(model);
        model.Id = id;
        _models[id] = model;
        return id;
    }

    public async Task<bool> UpdateModelAsync(Model model)
    {
        await EnsureInitializedAsync();
        var success = await _databaseService.UpdateModelAsync(model);
        if (success)
            _models[model.Id] = model;
        return success;
    }

    public async Task<bool> DeleteModelAsync(string modelId)
    {
        await EnsureInitializedAsync();
        var success = await _databaseService.DeleteModelAsync(modelId);
        if (success)
            _models.TryRemove(modelId, out _);
        return success;
    }

    // User-specific operations
    public async Task<List<Model>> GetAvailableModelsForUserAsync(List<UserRole> userRoles)
    {
        await EnsureInitializedAsync();
        return _models.Values
            .Where(m => m.AllowedRoles.Any(role => userRoles.Contains(role)))
            .ToList();
    }

    public async Task<Model?> GetModelForUserAsync(string modelId, List<UserRole> userRoles)
    {
        await EnsureInitializedAsync();
        if (!_models.TryGetValue(modelId, out var model))
            return null;

        return model.AllowedRoles.Any(role => userRoles.Contains(role)) ? model : null;
    }

    // Provider integration
    public async Task<(ModelEndpoint endpoint, Model model)?> GetModelWithEndpointAsync(string modelId)
    {
        await EnsureInitializedAsync();
        if (!_models.TryGetValue(modelId, out var model))
            return null;

        if (!_endpoints.TryGetValue(model.EndpointId, out var endpoint))
            return null;

        return (endpoint, model);
    }
}
