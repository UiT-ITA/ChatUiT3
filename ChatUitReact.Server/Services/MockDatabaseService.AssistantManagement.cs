using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService
{
    private readonly List<Assistant> _assistants = new();
    private readonly object _assistantsLock = new();

    public Task<List<Assistant>> GetAssistantsByOwnerAsync(string ownerId)
    {
        lock (_assistantsLock)
        {
            var assistants = _assistants.Where(a => a.OwnerId == ownerId).ToList();
            return Task.FromResult(DeepCopyList(assistants, DeepCopyAssistant));
        }
    }

    public Task<List<Assistant>> GetSystemAssistantsAsync()
    {
        lock (_assistantsLock)
        {
            var assistants = _assistants.Where(a => a.OwnerId == "System").ToList();
            return Task.FromResult(DeepCopyList(assistants, DeepCopyAssistant));
        }
    }

    public Task<List<Assistant>> GetAssistantsByIdsAsync(List<string> assistantIds)
    {
        lock (_assistantsLock)
        {
            var assistants = _assistants.Where(a => assistantIds.Contains(a.Id)).ToList();
            return Task.FromResult(DeepCopyList(assistants, DeepCopyAssistant));
        }
    }

    public Task<Assistant?> GetAssistantByIdAsync(string assistantId, bool includeFileContent = false)
    {
        lock (_assistantsLock)
        {
            var assistant = _assistants.FirstOrDefault(a => a.Id == assistantId);
            return Task.FromResult(assistant != null ? DeepCopyAssistant(assistant) : null);
        }
    }

    public Task<AssistantFile?> GetAssistantFileAsync(string assistantId, string fileId)
    {
        lock (_assistantsLock)
        {
            var assistant = _assistants.FirstOrDefault(a => a.Id == assistantId);
            var file = assistant?.Files.FirstOrDefault(f => f.Id == fileId);
            return Task.FromResult(file);
        }
    }

    public Task<Assistant> CreateAssistantAsync(Assistant assistant)
    {
        lock (_assistantsLock)
        {
            assistant.UpdatedAt = DateTime.UtcNow;
            var assistantCopy = DeepCopyAssistant(assistant);
            _assistants.Add(assistantCopy);
            return Task.FromResult(DeepCopyAssistant(assistantCopy));
        }
    }

    public Task<Assistant?> UpdateAssistantAsync(Assistant assistant)
    {
        lock (_assistantsLock)
        {
            var index = _assistants.FindIndex(a => a.Id == assistant.Id);
            if (index >= 0)
            {
                assistant.UpdatedAt = DateTime.UtcNow;
                var assistantCopy = DeepCopyAssistant(assistant);
                _assistants[index] = assistantCopy;
                return Task.FromResult<Assistant?>(DeepCopyAssistant(assistantCopy));
            }
            return Task.FromResult<Assistant?>(null);
        }
    }

    public Task<bool> DeleteAssistantAsync(string assistantId)
    {
        lock (_assistantsLock)
        {
            var assistant = _assistants.FirstOrDefault(a => a.Id == assistantId);
            if (assistant != null)
            {
                _assistants.Remove(assistant);
                return Task.FromResult(true);
            }
            return Task.FromResult(false);
        }
    }

    public async Task<UserInfo?> GetUserAsync(string userId)
    {
        try
        {
            return await GetUserInfoAsync(userId);
        }
        catch
        {
            return null;
        }
    }

    public async Task<bool> UpdateUserAsync(UserInfo user)
    {
        return await UpdateUserInfoAsync(user.Username, user);
    }
}
