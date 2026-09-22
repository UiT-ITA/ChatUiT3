using System.Collections.Concurrent;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService
{
    private readonly ConcurrentDictionary<string, ToolPolicy> _toolPolicies = new();

    public Task<List<ToolPolicy>> GetToolPoliciesAsync() => Task.FromResult(_toolPolicies.Values.ToList());

    public Task UpsertToolPolicyAsync(ToolPolicy policy)
    {
        _toolPolicies[policy.ToolId] = policy;
        return Task.CompletedTask;
    }

    public Task<bool> DeleteToolPolicyAsync(string toolId) => Task.FromResult(_toolPolicies.TryRemove(toolId, out _));
}
