using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public interface IModelService
{
    // Endpoint operations
    Task<List<ModelEndpoint>> GetAllEndpointsAsync();
    Task<ModelEndpoint?> GetEndpointByIdAsync(string endpointId);
    Task<string> CreateEndpointAsync(ModelEndpoint endpoint);
    Task<bool> UpdateEndpointAsync(ModelEndpoint endpoint);
    Task<bool> DeleteEndpointAsync(string endpointId);

    // Model operations
    Task<List<Model>> GetAllModelsAsync();
    Task<Model?> GetModelByIdAsync(string modelId);
    Task<string> CreateModelAsync(Model model);
    Task<bool> UpdateModelAsync(Model model);
    Task<bool> DeleteModelAsync(string modelId);

    // User-specific operations
    Task<List<Model>> GetAvailableModelsForUserAsync(List<UserRole> userRoles);
    Task<Model?> GetModelForUserAsync(string modelId, List<UserRole> userRoles);

    // Provider integration
    Task<(ModelEndpoint endpoint, Model model)?> GetModelWithEndpointAsync(string modelId);
}
