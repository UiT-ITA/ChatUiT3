using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService
{
    private readonly List<AiAssistant> _assistants = new();
    private readonly object _assistantsLock = new();

    public Task<List<AiAssistant>> GetAssistantsByOwnerAsync(string ownerId)
    {
        lock (_assistantsLock)
        {
            return Task.FromResult(_assistants.Where(a => a.OwnerId == ownerId).ToList());
        }
    }

    public Task<List<AiAssistant>> GetSystemAssistantsAsync()
    {
        lock (_assistantsLock)
        {
            return Task.FromResult(_assistants.Where(a => a.OwnerId == "System").ToList());
        }
    }

    public Task<List<AiAssistant>> GetAssistantsByIdsAsync(List<string> assistantIds)
    {
        lock (_assistantsLock)
        {
            return Task.FromResult(_assistants.Where(a => assistantIds.Contains(a.Id)).ToList());
        }
    }

    public Task<AiAssistant?> GetAssistantByIdAsync(string assistantId)
    {
        lock (_assistantsLock)
        {
            return Task.FromResult(_assistants.FirstOrDefault(a => a.Id == assistantId));
        }
    }

    public Task<AiAssistant> CreateAssistantAsync(AiAssistant assistant)
    {
        lock (_assistantsLock)
        {
            _assistants.Add(assistant);
            return Task.FromResult(assistant);
        }
    }

    public Task<AiAssistant?> UpdateAssistantAsync(AiAssistant assistant)
    {
        lock (_assistantsLock)
        {
            var index = _assistants.FindIndex(a => a.Id == assistant.Id);
            if (index >= 0)
            {
                _assistants[index] = assistant;
                return Task.FromResult<AiAssistant?>(assistant);
            }
            return Task.FromResult<AiAssistant?>(null);
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

    private void InitializeSystemAssistants()
    {
        var defaultModel = _models.Values.FirstOrDefault() ?? new AiModel
        {
            Id = "default-model",
            ModelName = "Default Model",
            EndpointId = "default-endpoint"
        };

        var systemAssistants = new List<AiAssistant>
        {
            new AiAssistant
            {
                Id = "system-general",
                Name = "General Assistant",
                Description = "A helpful general-purpose AI assistant",
                Tags = new List<string> { "general", "helpful" },
                Model = defaultModel,
                ChatSettings = new AiChatSettings
                {
                    SystemPrompt = "You are a helpful AI assistant. Be concise and accurate.",
                    Temperature = 0.7f,
                    ReasoningEffort = ReasoningEffort.Medium
                },
                OwnerId = "System"
            },
            new AiAssistant
            {
                Id = "system-coding",
                Name = "Coding Assistant",
                Description = "An AI assistant specialized in programming and code review",
                Tags = new List<string> { "coding", "programming", "development" },
                Model = defaultModel,
                ChatSettings = new AiChatSettings
                {
                    SystemPrompt = "You are a programming expert. Help with code, debugging, and best practices.",
                    Temperature = 0.3f,
                    ReasoningEffort = ReasoningEffort.High
                },
                OwnerId = "otv001@uit.no"
            }
        };

        lock (_assistantsLock)
        {
            _assistants.AddRange(systemAssistants);
        }
    }
}
