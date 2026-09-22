using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.AiProviders;
using ChatUitReact.Server.Services.Tools;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace ChatUitReact.Server.Services.Agents;

/// <summary>
/// Runs an <see cref="InternalAgent"/> on one task. Inner function calls go through the normal
/// <see cref="IToolExecutor"/>, so consent and confirmation behave as for any tool; their pauses
/// are forwarded under the outer tool call id, which is the only id the client knows. Inner
/// calls run one at a time, so that id is never waited on twice at once.
/// </summary>
public sealed class InternalAgentRunner
{
    private const string BudgetExhausted = "Function budget exhausted. Answer now with what you have; do not call more functions.";

    private readonly IModelService _modelService;
    private readonly IAiProviderRegistry _providers;
    // Resolved on first use: the executor depends on the registry, which constructs the agent
    // tools, which depend on this runner. Taking it in the constructor would be a cycle.
    private readonly IServiceProvider _services;
    private IToolExecutor? _executor;
    private readonly InternalAgentOptions _options;
    private readonly ILogger<InternalAgentRunner> _logger;

    public InternalAgentRunner(
        IModelService modelService,
        IAiProviderRegistry providers,
        IServiceProvider services,
        IOptions<InternalAgentOptions> options,
        ILogger<InternalAgentRunner> logger)
    {
        _modelService = modelService;
        _providers = providers;
        _services = services;
        _options = options.Value;
        _logger = logger;
    }

    public async IAsyncEnumerable<ToolExecutionEvent> RunAsync(
        InternalAgent agent,
        string task,
        ToolExecutionContext context,
        string outerToolCallId,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var resolved = await ResolveModelAsync(agent, context);
        if (resolved == null)
        {
            yield return Fail($"No model is available to run {agent.Id}. Configure InternalAgents:Models:{agent.Id} or use a chat model that supports function calling.");
            yield break;
        }

        var (model, endpoint) = resolved.Value;
        if (!_providers.Supports(endpoint.EndpointType))
        {
            yield return Fail($"No provider is registered for endpoint type {endpoint.EndpointType}.");
            yield break;
        }

        var request = BuildRequest(agent, task, model, endpoint, context);
        var conversation = _providers.For(endpoint.EndpointType).StartConversation(request);
        _logger.LogInformation("Agent {AgentId} starting on {Model}", agent.Id, model.ModelId);

        var lastText = new StringBuilder();
        var budgetExhausted = false;

        var round = 0;
        for (; ; round++)
        {
            var toolCalls = new List<AiStreamEvent.ToolCall>();
            lastText.Clear();

            await foreach (var streamEvent in conversation.StreamTurnAsync(cancellationToken))
            {
                switch (streamEvent)
                {
                    case AiStreamEvent.Text text:
                        lastText.Append(text.Delta);
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

            if (budgetExhausted)
            {
                _logger.LogWarning("Agent {AgentId} kept calling functions after the budget ran out", agent.Id);
                break;
            }

            var results = new List<AiToolResult>(toolCalls.Count);
            budgetExhausted = round >= agent.MaxRounds;

            foreach (var call in toolCalls)
            {
                cancellationToken.ThrowIfCancellationRequested();

                if (budgetExhausted)
                {
                    results.Add(new AiToolResult(call.Id, BudgetExhausted, IsError: true));
                    continue;
                }

                var function = agent.Functions.FirstOrDefault(f => f.Id == call.FunctionName);
                if (function == null)
                {
                    results.Add(new AiToolResult(call.Id, $"Unknown function: {call.FunctionName}", IsError: true));
                    continue;
                }

                ToolResult? result = null;
                var executor = _executor ??= _services.GetRequiredService<IToolExecutor>();
                await foreach (var evt in executor.ExecuteAsync(function, call with { Id = outerToolCallId }, context, cancellationToken))
                {
                    if (evt is ToolExecutionEvent.Completed done)
                    {
                        result = done.Result;
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

    private async Task<(Model model, ModelEndpoint endpoint)?> ResolveModelAsync(InternalAgent agent, ToolExecutionContext context)
    {
        if (_options.Models.TryGetValue(agent.Id, out var configuredId) && !string.IsNullOrWhiteSpace(configuredId))
        {
            var configured = await _modelService.GetModelWithEndpointAsync(configuredId);
            if (configured is { } found && found.model.Capabilities.SupportsFunctionCalling)
            {
                return (found.model, found.endpoint);
            }

            _logger.LogWarning("InternalAgents:Models:{AgentId} = {ModelId} is unknown or cannot call functions; falling back to the chat model", agent.Id, configuredId);
        }

        if (context.Model is { } model && context.Endpoint is { } endpoint && model.Capabilities.SupportsFunctionCalling)
        {
            return (model, endpoint);
        }

        return null;
    }

    private static AiRequest BuildRequest(InternalAgent agent, string task, Model model, ModelEndpoint endpoint, ToolExecutionContext context)
    {
        var settings = new ChatSettings
        {
            Temperature = 0.2f,
            ReasoningEffort = model.Capabilities.LowestEffort,
            AvailableToolIds = agent.Functions.Select(f => f.Id).ToList()
        };

        var systemPrompt = $"{agent.SystemPrompt.TrimEnd()}\n\nCurrent date and time (UTC): {DateTime.UtcNow:yyyy-MM-dd HH:mm} ({DateTime.UtcNow.DayOfWeek}).";
        if (!string.IsNullOrWhiteSpace(context.UserDisplayName) || !string.IsNullOrWhiteSpace(context.UserPrincipalName))
        {
            var who = string.Join(" ", new[] { context.UserDisplayName, context.UserPrincipalName is { Length: > 0 } upn ? $"({upn})" : null }.Where(s => !string.IsNullOrWhiteSpace(s)));
            systemPrompt += $"\nSigned-in user: {who}. The task may refer to this person by name; that always means the signed-in user, whose own data you read through the \"me\" functions and endpoints.";
        }

        return new AiRequest
        {
            Model = model,
            Endpoint = endpoint,
            SystemPrompt = systemPrompt,
            Messages = [new ChatMessage { Role = AiChatRole.User, Content = task }],
            Parameters = ChatParameterResolver.Resolve(model.Capabilities, settings),
            Tools = agent.Functions
        };
    }

    private static ToolExecutionEvent.Completed Fail(string message)
        => new(ToolResult.Error(message), ToolCallStatus.Error);
}
