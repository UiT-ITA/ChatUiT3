using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.AiProviders;
using ChatUiT.Server.Services.Tools;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace ChatUiT.Server.Services.Agents;

/// <summary>
/// Everything one run of an agent is set up with. The nested run and the Responses API run get
/// the same setup from <see cref="InternalAgentRunner.SetupAsync"/>.
/// </summary>
/// <param name="MaxRounds">Function call rounds before the model gets one last turn with function calls switched off.</param>
public sealed record InternalAgentSetup(
    Model Model,
    ModelEndpoint Endpoint,
    string SystemPrompt,
    ResolvedChatParameters Parameters,
    IReadOnlyList<ITool> Functions,
    int MaxRounds);

/// <summary>
/// Sets up every run of an <see cref="InternalAgent"/>, and runs it nested on one task. Inner
/// function calls go through the normal <see cref="IToolExecutor"/>, so confirmation
/// behave as for any tool; their pauses are forwarded under the outer tool call id, which is the
/// only id the client knows. Inner calls run one at a time, so that id is never waited on twice
/// at once.
/// </summary>
public sealed class InternalAgentRunner
{
    private const float Temperature = 0.2f;

    private readonly IModelService _modelService;
    private readonly IAiProviderRegistry _providers;
    private readonly InternalAgentSettingsService _settings;
    // Resolved on first use: the executor depends on the registry, which constructs the agent
    // tools, which depend on this runner. Taking it in the constructor would be a cycle.
    private readonly IServiceProvider _services;
    private IToolExecutor? _executor;
    private readonly ILogger<InternalAgentRunner> _logger;

    public InternalAgentRunner(
        IModelService modelService,
        IAiProviderRegistry providers,
        InternalAgentSettingsService settings,
        IServiceProvider services,
        ILogger<InternalAgentRunner> logger)
    {
        _modelService = modelService;
        _providers = providers;
        _settings = settings;
        _services = services;
        _logger = logger;
    }

    /// <summary>
    /// The model and reasoning level: the admin's setting for the agent, else the chat's model
    /// (<paramref name="context"/>) at its lowest level. Without a context, as when the API
    /// catalog resolves an agent, only the setting counts.
    /// </summary>
    public async Task<(Model Model, ModelEndpoint Endpoint, ReasoningEffort Effort)?> ResolveModelAsync(InternalAgent agent, ToolExecutionContext? context)
    {
        if (await _settings.GetAsync(agent.Id) is { } setting)
        {
            var stored = await _modelService.GetModelWithEndpointAsync(setting.ModelId);
            if (stored is { } found && found.model.Capabilities.SupportsFunctionCalling)
            {
                return (found.model, found.endpoint, setting.ReasoningEffort);
            }

            _logger.LogWarning("The model set for agent {AgentId} ({ModelId}) is unknown or cannot call functions", agent.Id, setting.ModelId);
        }

        if (context?.Model is { } model && context.Endpoint is { } endpoint && model.Capabilities.SupportsFunctionCalling)
        {
            return (model, endpoint, model.Capabilities.LowestEffort);
        }

        return null;
    }

    /// <summary>The setup for one run of <paramref name="agent"/>; null when no model is available.</summary>
    public async Task<InternalAgentSetup?> SetupAsync(InternalAgent agent, ToolExecutionContext context)
    {
        if (await ResolveModelAsync(agent, context) is not { } resolved)
        {
            return null;
        }

        var (model, endpoint, effort) = resolved;
        var now = DateTime.UtcNow;
        var systemPrompt = $"{agent.SystemPrompt.TrimEnd()}\n\nCurrent date and time (UTC): {now:yyyy-MM-dd HH:mm} ({now.DayOfWeek}).";
        if (!string.IsNullOrWhiteSpace(context.UserDisplayName) || !string.IsNullOrWhiteSpace(context.UserPrincipalName))
        {
            var who = string.Join(" ", new[] { context.UserDisplayName, context.UserPrincipalName is { Length: > 0 } upn ? $"({upn})" : null }.Where(s => !string.IsNullOrWhiteSpace(s)));
            systemPrompt += $"\nSigned-in user: {who}.";
        }

        var settings = new ChatSettings
        {
            Temperature = Temperature,
            ReasoningEffort = effort,
            AvailableToolIds = agent.Functions.Select(f => f.Id).ToList()
        };

        return new InternalAgentSetup(
            model,
            endpoint,
            systemPrompt,
            ChatParameterResolver.Resolve(model.Capabilities, settings) with { SummaryLength = context.ReasoningSummaryLength },
            agent.Functions,
            agent.MaxRounds);
    }

    public async IAsyncEnumerable<ToolExecutionEvent> RunAsync(
        InternalAgent agent,
        string task,
        ToolExecutionContext context,
        string outerToolCallId,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var setup = await SetupAsync(agent, context);
        if (setup == null)
        {
            yield return Fail($"No model is available to run {agent.Id}. Set its model under Internal agents, or use a chat model that supports function calling.");
            yield break;
        }

        if (!_providers.Supports(setup.Endpoint.EndpointType))
        {
            yield return Fail($"No provider is registered for endpoint type {setup.Endpoint.EndpointType}.");
            yield break;
        }

        var conversation = _providers.For(setup.Endpoint.EndpointType).StartConversation(new AiRequest
        {
            Model = setup.Model,
            Endpoint = setup.Endpoint,
            SystemPrompt = setup.SystemPrompt,
            Messages = [new AiInputItem.Message(new ChatMessage { Role = AiChatRole.User, Content = task })],
            Parameters = setup.Parameters,
            Tools = setup.Functions
        });
        _logger.LogInformation("Agent {AgentId} starting on {Model}", agent.Id, setup.Model.ModelId);

        var lastText = new StringBuilder();

        var round = 0;
        for (; ; round++)
        {
            // Once the budget is spent the model gets one more turn with function calls
            // switched off, so it has to answer.
            var allowToolCalls = round < setup.MaxRounds;
            var toolCalls = new List<AiStreamEvent.ToolCall>();
            lastText.Clear();
            // Reasoning summaries are reported as progress only; they never reach the outer model.
            var reasoningPartOpen = false;

            await foreach (var streamEvent in conversation.StreamTurnAsync(allowToolCalls, cancellationToken))
            {
                switch (streamEvent)
                {
                    case AiStreamEvent.Text text:
                        lastText.Append(text.Delta);
                        break;
                    case AiStreamEvent.Thinking thinking when !string.IsNullOrEmpty(thinking.Delta):
                        if (!reasoningPartOpen)
                        {
                            reasoningPartOpen = true;
                            yield return new ToolExecutionEvent.InnerReasoningPartStarted();
                        }

                        yield return new ToolExecutionEvent.InnerReasoningDelta(thinking.Delta);
                        break;
                    case AiStreamEvent.ThinkingBreak:
                        reasoningPartOpen = false;
                        break;
                    case AiStreamEvent.ToolCall call:
                        toolCalls.Add(call);
                        break;
                }
            }

            if (toolCalls.Count == 0)
            {
                break;
            }

            if (!allowToolCalls)
            {
                _logger.LogWarning("Agent {AgentId} called functions after the budget ran out", agent.Id);
                break;
            }

            var results = new List<AiToolResult>(toolCalls.Count);

            foreach (var call in toolCalls)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var function = setup.Functions.FirstOrDefault(f => f.Id == call.FunctionName);
                if (function == null)
                {
                    results.Add(new AiToolResult(call.Id, $"Unknown function: {call.FunctionName}", IsError: true));
                    continue;
                }

                yield return new ToolExecutionEvent.InnerCallStarted(function.Id);

                ToolResult? result = null;
                var executor = _executor ??= _services.GetRequiredService<IToolExecutor>();
                await foreach (var evt in executor.ExecuteAsync(function, call with { Id = outerToolCallId }, context, cancellationToken))
                {
                    if (evt is ToolExecutionEvent.Completed done)
                    {
                        result = done.Result;
                    }
                    else if (evt is ToolExecutionEvent.Deferred)
                    {
                        // Defer mode: the pause ends the outer call, which runs again in full
                        // once the user has answered. Nothing of this inner run is kept.
                        _logger.LogInformation("Agent {AgentId} call {Function} deferred; ending the run", agent.Id, call.FunctionName);
                        yield return evt;
                        yield break;
                    }
                    else
                    {
                        yield return evt;
                    }
                }

                result ??= ToolResult.Error("The function ended without a result.");
                // Names and status only: arguments and results carry the user's data.
                _logger.LogInformation("Agent {AgentId} call {Function} -> {Status}", agent.Id, call.FunctionName, result.IsError ? "error" : "ok");
                results.Add(new AiToolResult(call.Id, result.Content, result.IsError));
            }

            conversation.AppendToolResults(results);
        }

        var answer = lastText.ToString().Trim();
        _logger.LogInformation("Agent {AgentId} finished after {Rounds} round(s), {Chars} chars", agent.Id, round, answer.Length);
        yield return answer.Length > 0
            ? new ToolExecutionEvent.Completed(ToolResult.Text(answer), ToolCallStatus.Completed)
            : Fail("The agent produced no answer.");
    }

    private static ToolExecutionEvent.Completed Fail(string message)
        => new(ToolResult.Error(message), ToolCallStatus.Error);
}
