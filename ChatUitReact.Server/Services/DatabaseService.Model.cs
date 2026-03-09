using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class DatabaseService
{
    // Endpoint management
    public Task<List<ModelEndpoint>> GetEndpointsAsync()
    {
        throw new NotImplementedException();
    }

    public Task<ModelEndpoint?> GetEndpointByIdAsync(string endpointId)
    {
        throw new NotImplementedException();
    }

    public Task<string> CreateEndpointAsync(ModelEndpoint endpoint)
    {
        throw new NotImplementedException();
    }

    public Task<bool> UpdateEndpointAsync(ModelEndpoint endpoint)
    {
        throw new NotImplementedException();
    }

    public Task<bool> DeleteEndpointAsync(string endpointId) {
        throw new NotImplementedException();
    }

    // Model management
    public Task<List<Model>> GetModelsAsync()
    {
        throw new NotImplementedException();
    }

    public Task<Model?> GetModelByIdAsync(string modelId)
    {
        throw new NotImplementedException();
    }

    public Task<string> CreateModelAsync(Model model)
    {
        throw new NotImplementedException();
    }

    public Task<bool> UpdateModelAsync(Model model)
    {
        throw new NotImplementedException();
    }

    public Task<bool> DeleteModelAsync(string modelId) {
        throw new NotImplementedException();
    }
}
