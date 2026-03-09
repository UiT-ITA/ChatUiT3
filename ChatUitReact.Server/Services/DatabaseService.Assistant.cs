using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class DatabaseService
{
    public Task<List<Assistant>> GetAssistantsByOwnerAsync(string ownerId)
    {
        throw new NotImplementedException();
    }

    public Task<List<Assistant>> GetSystemAssistantsAsync()
    {
        throw new NotImplementedException();
    }

    public Task<List<Assistant>> GetAssistantsByIdsAsync(List<string> assistantIds)
    {
        throw new NotImplementedException();
    }

    public Task<Assistant?> GetAssistantByIdAsync(string assistantId)
    {
        throw new NotImplementedException();
    }

    public Task<Assistant> CreateAssistantAsync(Assistant assistant)
    {
        throw new NotImplementedException();
    }

    public Task<Assistant?> UpdateAssistantAsync(Assistant assistant)
    {
        throw new NotImplementedException();
    }

    public Task<bool> DeleteAssistantAsync(string assistantId)
    {
        throw new NotImplementedException();
    }

}
