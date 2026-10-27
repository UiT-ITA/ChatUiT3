using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;

namespace ChatUiT.Server.Services.Agents;

/// <summary>
/// The model and reasoning level an admin chose for an internal agent, and whether the Responses
/// API serves it. The effort is stored clamped to what the model accepts, as assistant settings are.
/// </summary>
/// <param name="ModelId">The <see cref="Model.Id"/> of a function-calling model.</param>
/// <param name="ExposedInApi">Whether the Responses API serves the agent, under its id.</param>
public sealed record InternalAgentSetting(string AgentId, string ModelId, ReasoningEffort ReasoningEffort, bool ExposedInApi, DateTime UpdatedAt);

/// <summary>Settings are cached in process like tool policies and written through.</summary>
public sealed class InternalAgentSettingsService
{
    private readonly IDatabaseService _database;
    private readonly ConcurrentDictionary<string, InternalAgentSetting> _settings = new(StringComparer.Ordinal);
    private readonly SemaphoreSlim _initLock = new(1, 1);
    private bool _initialized;

    public InternalAgentSettingsService(IDatabaseService database)
    {
        _database = database;
    }

    private async Task EnsureInitializedAsync()
    {
        if (_initialized) return;

        await _initLock.WaitAsync();
        try
        {
            if (_initialized) return;

            foreach (var setting in await _database.GetInternalAgentSettingsAsync())
            {
                _settings[setting.AgentId] = setting;
            }

            _initialized = true;
        }
        finally
        {
            _initLock.Release();
        }
    }

    public async Task<InternalAgentSetting?> GetAsync(string agentId)
    {
        await EnsureInitializedAsync();
        return _settings.TryGetValue(agentId, out var setting) ? setting : null;
    }

    public async Task SaveAsync(InternalAgentSetting setting)
    {
        await EnsureInitializedAsync();
        await _database.UpsertInternalAgentSettingAsync(setting);
        _settings[setting.AgentId] = setting;
    }
}
