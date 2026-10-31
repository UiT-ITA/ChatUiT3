using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Agents;
using ChatUiT.Server.Services.AiProviders;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.ApiCatalog;

/// <summary>
/// One "model" of the Responses API resolved for one caller: what runs, and on which model.
/// </summary>
/// <param name="PublicId">The id clients send as <c>model</c>: the agent's id, or the model's <see cref="Model.ModelId"/>.</param>
/// <param name="Created">When it was last configured, for <c>GET /models</c>.</param>
public sealed record ApiTarget(string PublicId, DateTime Created, LanguageModel Model, ModelEndpoint Endpoint, InternalAgent? Agent);

public interface IApiCatalogService
{
    /// <summary>The target when this caller may use it; null otherwise, so the API can answer 404 either way.</summary>
    Task<ApiTarget?> ResolveAsync(string publicId, UserAccess access);

    /// <summary>Every target this caller may use, for <c>GET /models</c>.</summary>
    Task<IReadOnlyList<ApiTarget>> GetUsableAsync(UserAccess access);

    /// <summary>Why the model cannot be exposed under its <see cref="Model.ModelId"/>, or null.</summary>
    Task<string?> ModelExposureProblemAsync(LanguageModel model);
}

/// <summary>
/// The Responses API serves the internal agents and the model rows an admin ticked "Exposed in
/// the API" on. Access is the rule that already applies to each:
///
/// <list type="bullet">
/// <item>an agent needs its <see cref="InternalAgent.DefaultPolicy"/>. It runs on the model set
/// for it under Internal agents, resolved as for every run of the agent
/// (<see cref="InternalAgentRunner.ResolveModelAsync"/>); the caller's roles on that model are not
/// checked, as for a nested run. Without a set model the agent is not usable here, and it must
/// pass <see cref="ExposureProblem"/>.</item>
/// <item>a model needs the caller to have one of its <see cref="Model.AllowedRoles"/> (the existing
/// cost gate).</item>
/// </list>
///
/// Each tool is still checked per call by the tool executor.
/// </summary>
public sealed partial class ApiCatalogService : IApiCatalogService
{
    private readonly IModelService _models;
    private readonly IInternalAgentRegistry _agents;
    private readonly InternalAgentSettingsService _settings;
    private readonly InternalAgentRunner _agentRunner;
    private readonly IAiProviderRegistry _providers;

    public ApiCatalogService(IModelService models, IInternalAgentRegistry agents, InternalAgentSettingsService settings, InternalAgentRunner agentRunner, IAiProviderRegistry providers)
    {
        _models = models;
        _agents = agents;
        _settings = settings;
        _agentRunner = agentRunner;
        _providers = providers;
    }

    /// <summary>The rule for a public id. An agent's id always matches it; a model's ModelId must, to be exposed.</summary>
    [GeneratedRegex("^[a-z0-9][a-z0-9._-]{0,63}$")]
    public static partial Regex PublicIdPattern();

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

    public async Task<string?> ModelExposureProblemAsync(LanguageModel model)
    {
        if (!PublicIdPattern().IsMatch(model.ModelId))
        {
            return $"The model id '{model.ModelId}' is its id in the API, so it must match ^[a-z0-9][a-z0-9._-]{{0,63}}$.";
        }

        if (_agents.Find(model.ModelId) != null)
        {
            return $"The model id '{model.ModelId}' is an internal agent's id in the API.";
        }

        var other = (await _models.GetModelsAsync<LanguageModel>()).FirstOrDefault(m => m.ExposedInApi && m.Id != model.Id && m.ModelId == model.ModelId);
        return other == null ? null : $"'{other.ModelName}' is already exposed in the API with the model id '{model.ModelId}'.";
    }

    public async Task<ApiTarget?> ResolveAsync(string publicId, UserAccess access)
    {
        if (_agents.Find(publicId) is { } agent)
        {
            return await ResolveAgentAsync(agent, access);
        }

        var model = (await _models.GetModelsAsync<LanguageModel>()).FirstOrDefault(m => m.ExposedInApi && m.ModelId == publicId);
        return model == null ? null : await ResolveModelAsync(model, access);
    }

    public async Task<IReadOnlyList<ApiTarget>> GetUsableAsync(UserAccess access)
    {
        var result = new List<ApiTarget>();
        foreach (var agent in _agents.Agents)
        {
            if (await ResolveAgentAsync(agent, access) is { } target)
            {
                result.Add(target);
            }
        }

        foreach (var model in (await _models.GetModelsAsync<LanguageModel>()).Where(m => m.ExposedInApi))
        {
            if (await ResolveModelAsync(model, access) is { } target)
            {
                result.Add(target);
            }
        }

        return result.OrderBy(target => target.PublicId, StringComparer.Ordinal).ToList();
    }

    private async Task<ApiTarget?> ResolveAgentAsync(InternalAgent agent, UserAccess access)
    {
        if (await _settings.GetAsync(agent.Id) is not { ExposedInApi: true } setting
            || !agent.DefaultPolicy.Allows(access) || ExposureProblem(agent) != null
            || await _agentRunner.ResolveModelAsync(agent, context: null) is not { } resolved
            || !_providers.Supports(resolved.Endpoint.EndpointType))
        {
            return null;
        }

        return new ApiTarget(agent.Id, setting.UpdatedAt, resolved.Model, resolved.Endpoint, agent);
    }

    private async Task<ApiTarget?> ResolveModelAsync(LanguageModel model, UserAccess access)
    {
        if (!PublicIdPattern().IsMatch(model.ModelId) || !model.AllowedRoles.Any(access.Roles.Contains)
            || await _models.GetModelWithEndpointAsync<LanguageModel>(model.Id) is not { } found
            || !_providers.Supports(found.endpoint.EndpointType))
        {
            return null;
        }

        // A model row has no timestamp of its own.
        return new ApiTarget(model.ModelId, DateTime.UnixEpoch, found.model, found.endpoint, null);
    }
}
