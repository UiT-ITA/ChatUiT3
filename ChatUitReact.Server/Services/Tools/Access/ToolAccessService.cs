using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services.Tools;

public sealed class ToolAccessService : IToolAccessService
{
    private readonly IToolRegistry _registry;
    private readonly IDatabaseService _database;
    private readonly ConcurrentDictionary<string, ToolPolicy> _overrides = new();
    private readonly SemaphoreSlim _initLock = new(1, 1);
    private bool _initialized;

    public ToolAccessService(IToolRegistry registry, IDatabaseService database)
    {
        _registry = registry;
        _database = database;
    }

    private async Task EnsureInitializedAsync()
    {
        if (_initialized) return;

        await _initLock.WaitAsync();
        try
        {
            if (_initialized) return;

            foreach (var policy in await _database.GetToolPoliciesAsync())
            {
                _overrides[policy.ToolId] = policy;
            }

            _initialized = true;
        }
        finally
        {
            _initLock.Release();
        }
    }

    public async Task<ToolAccessPolicy> GetEffectivePolicyAsync(string toolId)
    {
        await EnsureInitializedAsync();

        if (_overrides.TryGetValue(toolId, out var stored))
        {
            return stored.Policy;
        }

        if (toolId == ToolRegistry.ClientToolsPolicyId)
        {
            return ToolAccessPolicy.Everyone;
        }

        return _registry.Find(toolId)?.DefaultPolicy ?? new ToolAccessPolicy { Enabled = false };
    }

    public async Task<ToolPolicy?> GetStoredPolicyAsync(string toolId)
    {
        await EnsureInitializedAsync();
        return _overrides.TryGetValue(toolId, out var stored) ? stored : null;
    }

    public async Task<IReadOnlyList<ITool>> GetToolsForUserAsync(UserAccess access)
    {
        var result = new List<ITool>();
        foreach (var tool in _registry.ServerTools)
        {
            if (await CanUseAsync(tool, access))
            {
                result.Add(tool);
            }
        }

        return result;
    }

    public async Task<bool> CanUseAsync(ITool tool, UserAccess access)
    {
        if (tool.Execution == ToolExecution.Client)
        {
            return await MayUseClientToolsAsync(access);
        }

        var policy = await GetEffectivePolicyForAsync(tool);
        return policy.Allows(access);
    }

    /// <summary>
    /// Like <see cref="GetEffectivePolicyAsync"/>, but for a tool instance that may not be in the
    /// registry (an internal agent's private function). Such tools have no stored override and
    /// answer with their code default.
    /// </summary>
    private async Task<ToolAccessPolicy> GetEffectivePolicyForAsync(ITool tool)
        => _registry.Find(tool.Id) != null ? await GetEffectivePolicyAsync(tool.Id) : tool.DefaultPolicy;

    public async Task<ToolIdCheck> CheckToolIdsAsync(IEnumerable<string> toolIds, UserAccess access)
    {
        var unknown = new List<string>();
        var disallowed = new List<string>();

        foreach (var id in (toolIds ?? []).Distinct())
        {
            var tool = _registry.Find(id);
            if (tool == null)
            {
                unknown.Add(id);
            }
            else if (!await CanUseAsync(tool, access))
            {
                disallowed.Add(tool.Id);
            }
        }

        return new ToolIdCheck(unknown, disallowed);
    }

    public async Task<IReadOnlyList<ITool>> FilterAllowedAsync(IEnumerable<string> toolIds, UserAccess access)
    {
        var result = new List<ITool>();
        foreach (var tool in _registry.Resolve(toolIds))
        {
            if (await CanUseAsync(tool, access))
            {
                result.Add(tool);
            }
        }

        return result;
    }

    public async Task<bool> MayUseClientToolsAsync(UserAccess access)
        => (await GetEffectivePolicyAsync(ToolRegistry.ClientToolsPolicyId)).Allows(access);

    public async Task<IReadOnlyList<ToolPolicy>> GetStoredPoliciesAsync()
    {
        await EnsureInitializedAsync();
        return _overrides.Values.ToList();
    }

    public async Task SetOverrideAsync(string toolId, ToolAccessPolicy policy)
    {
        await EnsureInitializedAsync();

        var stored = new ToolPolicy { ToolId = toolId, Policy = policy, UpdatedAt = DateTime.UtcNow };
        await _database.UpsertToolPolicyAsync(stored);
        _overrides[toolId] = stored;
    }

    public async Task<bool> ClearOverrideAsync(string toolId)
    {
        await EnsureInitializedAsync();

        var removed = _overrides.TryRemove(toolId, out _);
        var deleted = await _database.DeleteToolPolicyAsync(toolId);
        return removed || deleted;
    }
}
