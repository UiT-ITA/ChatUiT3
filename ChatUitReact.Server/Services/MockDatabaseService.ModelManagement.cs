using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService
{
    public Task<List<AiModel>> GetModelsAsync()
    {
        InitializeEndpointsAndModels();
        return Task.FromResult(_models.Values.ToList());
    }

    public Task<AiModel?> GetModelByIdAsync(string modelId)
    {
        InitializeEndpointsAndModels();
        _models.TryGetValue(modelId, out var model);
        return Task.FromResult<AiModel?>(model);
    }

    public Task<string> CreateModelAsync(AiModel model)
    {
        InitializeEndpointsAndModels();
        model.Id = Guid.NewGuid().ToString();
        _models[model.Id] = model;
        return Task.FromResult(model.Id);
    }

    public Task<bool> UpdateModelAsync(AiModel model)
    {
        InitializeEndpointsAndModels();
        if (_models.ContainsKey(model.Id))
        {
            _models[model.Id] = model;
            return Task.FromResult(true);
        }
        return Task.FromResult(false);
    }

    public Task<bool> DeleteModelAsync(string modelId)
    {
        InitializeEndpointsAndModels();
        return Task.FromResult(_models.TryRemove(modelId, out _));
    }
}
