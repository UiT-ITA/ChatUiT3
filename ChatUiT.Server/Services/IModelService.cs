using ChatUiT.Server.Models;

namespace ChatUiT.Server.Services;

public interface IModelService
{
    // Endpoint operations
    Task<List<ModelEndpoint>> GetAllEndpointsAsync();
    Task<ModelEndpoint?> GetEndpointByIdAsync(string endpointId);
    Task<string> CreateEndpointAsync(ModelEndpoint endpoint);
    Task<bool> UpdateEndpointAsync(ModelEndpoint endpoint);
    Task<bool> DeleteEndpointAsync(string endpointId);

    // Model operations, over every model type. TModel picks the type; Model means all of them.
    Task<List<TModel>> GetModelsAsync<TModel>() where TModel : Model;
    Task<TModel?> GetModelAsync<TModel>(string modelId) where TModel : Model;
    Task<string> CreateModelAsync(Model model);
    Task<bool> UpdateModelAsync(Model model);
    Task<bool> DeleteModelAsync(string modelId);

    // User-specific operations
    Task<List<TModel>> GetModelsForUserAsync<TModel>(List<UserRole> userRoles) where TModel : Model;
    Task<TModel?> GetModelForUserAsync<TModel>(string modelId, List<UserRole> userRoles) where TModel : Model;

    // Provider integration
    Task<(ModelEndpoint endpoint, TModel model)?> GetModelWithEndpointAsync<TModel>(string modelId) where TModel : Model;
}
