using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService
{
    public Task<List<AiModelEndpoint>> GetEndpointsAsync()
    {
        InitializeEndpointsAndModels();
        return Task.FromResult(_endpoints.Values.ToList());
    }

    public Task<AiModelEndpoint?> GetEndpointByIdAsync(string endpointId)
    {
        InitializeEndpointsAndModels();
        _endpoints.TryGetValue(endpointId, out var endpoint);
        return Task.FromResult<AiModelEndpoint?>(endpoint);
    }

    public Task<string> CreateEndpointAsync(AiModelEndpoint endpoint)
    {
        InitializeEndpointsAndModels();
        endpoint.Id = Guid.NewGuid().ToString();
        _endpoints[endpoint.Id] = endpoint;
        return Task.FromResult(endpoint.Id);
    }

    public Task<bool> UpdateEndpointAsync(AiModelEndpoint endpoint)
    {
        InitializeEndpointsAndModels();
        if (_endpoints.ContainsKey(endpoint.Id))
        {
            _endpoints[endpoint.Id] = endpoint;
            return Task.FromResult(true);
        }
        return Task.FromResult(false);
    }

    public Task<bool> DeleteEndpointAsync(string endpointId)
    {
        InitializeEndpointsAndModels();
        return Task.FromResult(_endpoints.TryRemove(endpointId, out _));
    }
}
