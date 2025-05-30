using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService
{
    public Task<List<AiModel>> GetModelsAsync()
    {
        return Task.FromResult(_models.Values.ToList());
    }

    public Task<AiModel?> GetModelByIdAsync(string modelId)
    {
        _models.TryGetValue(modelId, out var model);
        return Task.FromResult<AiModel?>(model);
    }

    public Task<string> CreateModelAsync(AiModel model)
    {
        model.Id = Guid.NewGuid().ToString();
        _models[model.Id] = model;
        return Task.FromResult(model.Id);
    }

    public Task<bool> UpdateModelAsync(AiModel model)
    {
        if (_models.ContainsKey(model.Id))
        {
            _models[model.Id] = model;
            return Task.FromResult(true);
        }
        return Task.FromResult(false);
    }

    public Task<bool> DeleteModelAsync(string modelId)
    {
        return Task.FromResult(_models.TryRemove(modelId, out _));
    }
}
