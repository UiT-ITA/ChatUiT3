using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public interface IModelService
{
    // Endpoint operations
    Task<List<AiModelEndpoint>> GetAllEndpointsAsync();
    Task<AiModelEndpoint?> GetEndpointByIdAsync(string endpointId);
    Task<string> CreateEndpointAsync(AiModelEndpoint endpoint);
    Task<bool> UpdateEndpointAsync(AiModelEndpoint endpoint);
    Task<bool> DeleteEndpointAsync(string endpointId);

    // Model operations
    Task<List<AiModel>> GetAllModelsAsync();
    Task<AiModel?> GetModelByIdAsync(string modelId);
    Task<string> CreateModelAsync(AiModel model);
    Task<bool> UpdateModelAsync(AiModel model);
    Task<bool> DeleteModelAsync(string modelId);

    // User-specific operations
    Task<List<AiModel>> GetAvailableModelsForUserAsync(List<UserRole> userRoles);
    Task<AiModel?> GetModelForUserAsync(string modelId, List<UserRole> userRoles);

    // Provider integration
    Task<(AiModelEndpoint endpoint, AiModel model)?> GetModelWithEndpointAsync(string modelId);
}
