using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService
{
    public Task<List<Model>> GetModelsAsync()
    {
        return Task.FromResult(_models.Values.ToList());
    }

    public Task<Model?> GetModelByIdAsync(string modelId)
    {
        _models.TryGetValue(modelId, out var model);
        return Task.FromResult<Model?>(model);
    }

    public Task<string> CreateModelAsync(Model model)
    {
        model.Id = Guid.NewGuid().ToString();
        _models[model.Id] = model;
        return Task.FromResult(model.Id);
    }

    public Task<bool> UpdateModelAsync(Model model)
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
