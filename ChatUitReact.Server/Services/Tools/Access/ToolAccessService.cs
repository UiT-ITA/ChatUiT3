using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using Microsoft.Extensions.Logging;

namespace ChatUitReact.Server.Services.Tools;

public sealed class ToolAccessService : IToolAccessService
{
    private readonly IToolboxRegistry _toolboxes;
    private readonly IDatabaseService _database;
    private readonly ILogger<ToolAccessService> _logger;
    private readonly ConcurrentDictionary<string, ToolPolicy> _overrides = new();
    private readonly SemaphoreSlim _initLock = new(1, 1);
    private bool _initialized;

    public ToolAccessService(IToolboxRegistry toolboxes, IDatabaseService database, ILogger<ToolAccessService> logger)
    {
        _toolboxes = toolboxes;
        _database = database;
        _logger = logger;
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

            await MigrateLegacyOverridesAsync(stored);
            _initialized = true;
        }
        finally
        {
            _initLock.Release();
        }
    }

    /// <summary>
    /// An override stored under a legacy id is copied onto each toolbox the id maps to that has
    /// no override of its own, then deleted. Legacy ids are taken in ordinal order, so where two
    /// map to the same toolbox the first one's policy is kept.
    /// </summary>
    private async Task MigrateLegacyOverridesAsync(IEnumerable<ToolPolicy> stored)
    {
        foreach (var legacy in stored.Where(IsLegacy).OrderBy(p => p.ToolId, StringComparer.Ordinal))
        {
            foreach (var toolboxId in _toolboxes.Expand(legacy.ToolId))
            {
                if (_overrides.ContainsKey(toolboxId))
                {
                    continue;
                }

                var copy = new ToolPolicy { ToolId = toolboxId, Policy = legacy.Policy, UpdatedAt = DateTime.UtcNow };
                await _database.UpsertToolPolicyAsync(copy);
                _overrides[toolboxId] = copy;
            }

            await _database.DeleteToolPolicyAsync(legacy.ToolId);
            _overrides.TryRemove(legacy.ToolId, out _);
            _logger.LogInformation("Moved the policy stored under legacy id {LegacyId} to toolboxes {ToolboxIds}", legacy.ToolId, string.Join(", ", _toolboxes.Expand(legacy.ToolId)));
        }

        // Unknown ids expand to themselves; only a legacy id expands to something else.
        bool IsLegacy(ToolPolicy policy)
            => !_toolboxes.Expand(policy.ToolId).SequenceEqual([policy.ToolId]);
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
        => (await GetEffectivePolicyAsync(toolbox.Id)).Allows(access);

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
        var unknown = new List<string>();
        var disallowed = new List<string>();

        foreach (var id in (toolboxIds ?? []).SelectMany(_toolboxes.Expand).Distinct())
        {
            var toolbox = _toolboxes.Find(id);
            if (toolbox == null)
            {
                unknown.Add(id);
            }
            else if (!await CanUseAsync(toolbox, access))
            {
                disallowed.Add(toolbox.Id);
            }
        }

        return new ToolIdCheck(unknown, disallowed);
    }

    public async Task<IReadOnlyList<IToolbox>> FilterAllowedAsync(IEnumerable<string> toolboxIds, UserAccess access)
    {
        var result = new List<IToolbox>();
        foreach (var toolbox in _toolboxes.Resolve(toolboxIds))
        {
            if (await CanUseAsync(toolbox, access))
            {
                result.Add(toolbox);
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
