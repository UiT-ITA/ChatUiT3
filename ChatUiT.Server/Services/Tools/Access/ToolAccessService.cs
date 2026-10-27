using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;

namespace ChatUiT.Server.Services.Tools;

public sealed class ToolAccessService : IToolAccessService
{
    private readonly IToolboxRegistry _toolboxes;
    private readonly IDatabaseService _database;
    private readonly ConcurrentDictionary<string, ToolPolicy> _overrides = new();
    private readonly SemaphoreSlim _initLock = new(1, 1);
    private bool _initialized;

    public ToolAccessService(IToolboxRegistry toolboxes, IDatabaseService database)
    {
        _toolboxes = toolboxes;
        _database = database;
    }

    private async Task EnsureInitializedAsync()
    {
        if (_initialized) return;

        await _initLock.WaitAsync();
        try
        {
            if (_initialized) return;

            var stored = await _database.GetToolPoliciesAsync();
            foreach (var policy in stored)
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

    public async Task<ToolAccessPolicy> GetEffectivePolicyAsync(string toolboxId)
    {
        await EnsureInitializedAsync();

        if (_overrides.TryGetValue(toolboxId, out var stored))
        {
            return stored.Policy;
        }

        if (toolboxId == ToolRegistry.ClientToolsPolicyId)
        {
            return ToolAccessPolicy.Everyone;
        }

        return _toolboxes.Find(toolboxId)?.DefaultPolicy ?? new ToolAccessPolicy { Enabled = false };
    }

    public async Task<ToolPolicy?> GetStoredPolicyAsync(string toolboxId)
    {
        await EnsureInitializedAsync();
        return _overrides.TryGetValue(toolboxId, out var stored) ? stored : null;
    }

    public async Task<IReadOnlyList<IToolbox>> GetToolboxesForUserAsync(UserAccess access)
    {
        var result = new List<IToolbox>();
        foreach (var toolbox in _toolboxes.Toolboxes)
        {
            if (await CanUseAsync(toolbox, access))
            {
                result.Add(toolbox);
            }
        }

        return result;
    }

    public async Task<bool> CanUseAsync(IToolbox toolbox, UserAccess access)
        => (await GetEffectivePolicyAsync(toolbox.Id)).Allows(access)
            && (_toolboxes.ParentOf(toolbox.Id) is not { } parent || await CanUseAsync(parent, access));

    public async Task<bool> CanUseAsync(ITool tool, UserAccess access)
    {
        if (tool.Execution == ToolExecution.Client)
        {
            return await MayUseClientToolsAsync(access);
        }

        // A tool in no toolbox (the knowledge file loader, the toolbox loader) answers with its
        // code default.
        var holders = _toolboxes.Containing(tool.Id);
        if (holders.Count == 0)
        {
            return tool.DefaultPolicy.Allows(access);
        }

        foreach (var toolbox in holders)
        {
            if (await CanUseAsync(toolbox, access))
            {
                return true;
            }
        }

        return false;
    }

    public async Task<ToolIdCheck> CheckToolIdsAsync(IEnumerable<string> toolboxIds, UserAccess access)
    {
        var ids = (toolboxIds ?? []).Distinct().ToList();
        var invalid = _toolboxes.Invalid(ids);
        var disallowed = new List<string>();

        foreach (var toolbox in ids.Except(invalid).Select(_toolboxes.Find).OfType<IToolbox>())
        {
            if (!await CanUseAsync(toolbox, access))
            {
                disallowed.Add(toolbox.Id);
            }
        }

        return new ToolIdCheck(invalid, disallowed);
    }

    public async Task<IReadOnlyList<ResolvedToolbox>> FilterAllowedAsync(IEnumerable<string> toolboxIds, UserAccess access)
    {
        var allowed = new List<string>();
        foreach (var toolbox in (toolboxIds ?? []).Select(_toolboxes.Find).OfType<IToolbox>())
        {
            if (await CanUseAsync(toolbox, access))
            {
                allowed.Add(toolbox.Id);
            }
        }

        return _toolboxes.Resolve(allowed);
    }

    public async Task<bool> MayUseClientToolsAsync(UserAccess access)
        => (await GetEffectivePolicyAsync(ToolRegistry.ClientToolsPolicyId)).Allows(access);

    public async Task<IReadOnlyList<ToolPolicy>> GetStoredPoliciesAsync()
    {
        await EnsureInitializedAsync();
        return _overrides.Values.ToList();
    }

    public async Task SetOverrideAsync(string toolboxId, ToolAccessPolicy policy)
    {
        await EnsureInitializedAsync();

        var stored = new ToolPolicy { ToolId = toolboxId, Policy = policy, UpdatedAt = DateTime.UtcNow };
        await _database.UpsertToolPolicyAsync(stored);
        _overrides[toolboxId] = stored;
    }

    public async Task<bool> ClearOverrideAsync(string toolboxId)
    {
        await EnsureInitializedAsync();

        var removed = _overrides.TryRemove(toolboxId, out _);
        var deleted = await _database.DeleteToolPolicyAsync(toolboxId);
        return removed || deleted;
    }
}
