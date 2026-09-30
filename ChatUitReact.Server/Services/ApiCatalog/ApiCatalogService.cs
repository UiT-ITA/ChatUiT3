using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Agents;
using ChatUitReact.Server.Services.AiProviders;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.ApiCatalog;

/// <summary>A catalog entry resolved for one caller: what runs, and on which model.</summary>
public sealed record ApiTarget(ApiCatalogEntry Entry, Model Model, ModelEndpoint Endpoint, InternalAgent? Agent);

public interface IApiCatalogService
{
    Task<IReadOnlyList<ApiCatalogEntry>> GetEntriesAsync();

    Task<ApiCatalogEntry?> GetEntryAsync(string publicId);

    Task UpsertAsync(ApiCatalogEntry entry);

    Task<bool> DeleteAsync(string publicId);

    /// <summary>The entry and its target when this caller may use it; null otherwise, so the API can answer 404 either way.</summary>
    Task<ApiTarget?> ResolveAsync(string publicId, UserAccess access);

    /// <summary>Every entry this caller may use, for <c>GET /models</c>.</summary>
    Task<IReadOnlyList<ApiTarget>> GetUsableAsync(UserAccess access);
}

/// <summary>
/// Entries are cached in process like tool policies and written through. Access is the
/// intersection of every rule that already applies elsewhere:
///
/// <list type="bullet">
/// <item>a raw model needs the entry's policy and the model row's <see cref="Model.AllowedRoles"/>
/// (the existing cost gate);</item>
/// <item>an agent needs the entry's policy and the agent's <see cref="InternalAgent.DefaultPolicy"/>.
/// It runs on the model set for it under Internal agents, resolved as for every run of the agent
/// (<see cref="InternalAgentRunner.ResolveModelAsync"/>); the caller's roles on that model are not
/// checked, as for a nested run. Without a set model the agent is not usable here, and it must
/// pass <see cref="ExposureProblem"/>.</item>
/// </list>
///
/// Each tool is still checked per call by the tool executor.
/// </summary>
public sealed class ApiCatalogService : IApiCatalogService
{
    private readonly IDatabaseService _database;
    private readonly IModelService _models;
    private readonly IInternalAgentRegistry _agents;
    private readonly InternalAgentRunner _agentRunner;
    private readonly IAiProviderRegistry _providers;
    private readonly ConcurrentDictionary<string, ApiCatalogEntry> _entries = new(StringComparer.Ordinal);
    private readonly SemaphoreSlim _initLock = new(1, 1);
    private bool _initialized;

    public ApiCatalogService(IDatabaseService database, IModelService models, IInternalAgentRegistry agents, InternalAgentRunner agentRunner, IAiProviderRegistry providers)
    {
        _database = database;
        _models = models;
        _agents = agents;
        _agentRunner = agentRunner;
        _providers = providers;
    }

    /// <summary>
    /// Why the agent cannot be exposed, or null. A pause inside a nested agent ends the outer call,
    /// which then runs again in full, so an approval inside it cannot be resumed: it could not be
    /// tied to the arguments a second inner run produces. An agent whose function is an agent tool
    /// with confirmable functions is therefore refused. Checked on save and on every resolve.
    /// </summary>
    public static string? ExposureProblem(InternalAgent agent)
    {
        foreach (var function in agent.Functions)
        {
            if (function is InternalAgentTool nested && nested.Agent.Functions.OfType<IConfirmableTool>().FirstOrDefault() is { } confirmable)
            {
                return $"'{agent.Id}' cannot be exposed: its function '{function.Id}' is an agent whose function '{confirmable.Id}' needs confirmation, which the Responses API cannot resume inside a nested agent.";
            }
        }

        return null;
    }

    private async Task EnsureInitializedAsync()
    {
        if (_initialized) return;

        await _initLock.WaitAsync();
        try
        {
            if (_initialized) return;

            foreach (var entry in await _database.GetApiCatalogEntriesAsync())
            {
                _entries[entry.PublicId] = entry;
            }

            _initialized = true;
        }
        finally
        {
            _initLock.Release();
        }
    }

    public async Task<IReadOnlyList<ApiCatalogEntry>> GetEntriesAsync()
    {
        await EnsureInitializedAsync();
        return _entries.Values.OrderBy(e => e.PublicId, StringComparer.Ordinal).ToList();
    }

    public async Task<ApiCatalogEntry?> GetEntryAsync(string publicId)
    {
        await EnsureInitializedAsync();
        return _entries.TryGetValue(publicId, out var entry) ? entry : null;
    }

    public async Task UpsertAsync(ApiCatalogEntry entry)
    {
        await EnsureInitializedAsync();
        await _database.UpsertApiCatalogEntryAsync(entry);
        _entries[entry.PublicId] = entry;
    }

    public async Task<bool> DeleteAsync(string publicId)
    {
        await EnsureInitializedAsync();

        var removed = _entries.TryRemove(publicId, out _);
        var deleted = await _database.DeleteApiCatalogEntryAsync(publicId);
        return removed || deleted;
    }

    public async Task<ApiTarget?> ResolveAsync(string publicId, UserAccess access)
    {
        var entry = await GetEntryAsync(publicId);
        return entry == null ? null : await ResolveEntryAsync(entry, access);
    }

    public async Task<IReadOnlyList<ApiTarget>> GetUsableAsync(UserAccess access)
    {
        var result = new List<ApiTarget>();
        foreach (var entry in await GetEntriesAsync())
        {
            if (await ResolveEntryAsync(entry, access) is { } target)
            {
                result.Add(target);
            }
        }

        return result;
    }

    private async Task<ApiTarget?> ResolveEntryAsync(ApiCatalogEntry entry, UserAccess access)
    {
        if (!entry.Allows(access))
        {
            return null;
        }

        if (entry.Kind == ApiCatalogKind.Agent)
        {
            var agent = _agents.Find(entry.TargetId);
            if (agent == null || !agent.DefaultPolicy.Allows(access) || ExposureProblem(agent) != null
                || await _agentRunner.ResolveModelAsync(agent, context: null) is not { } resolved
                || !_providers.Supports(resolved.Endpoint.EndpointType))
            {
                return null;
            }

            return new ApiTarget(entry, resolved.Model, resolved.Endpoint, agent);
        }

        if (await _models.GetModelWithEndpointAsync(entry.TargetId) is not { } found)
        {
            return null;
        }

        var (endpoint, model) = found;
        if (!model.AllowedRoles.Any(access.Roles.Contains) || !_providers.Supports(endpoint.EndpointType))
        {
            return null;
        }

        return new ApiTarget(entry, model, endpoint, null);
    }
}
