using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.AiProviders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace ChatUitReact.Server.Services.Tools;

public sealed class ToolExecutor : IToolExecutor
{
    private const int MaxConsentRetries = 3;

    private readonly IToolAccessService _access;
    private readonly PendingInteractionRegistry _pending;
    private readonly ToolOptions _options;
    private readonly ILogger<ToolExecutor> _logger;

    public ToolExecutor(
        IToolAccessService access,
        PendingInteractionRegistry pending,
        IOptions<ToolOptions> options,
        ILogger<ToolExecutor> logger)
    {
        _access = access;
        _pending = pending;
        _options = options.Value;
        _logger = logger;
    }

    public async IAsyncEnumerable<ToolExecutionEvent> ExecuteAsync(
        ITool tool,
        AiStreamEvent.ToolCall call,
        ToolExecutionContext context,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        // The work runs on its own task and reports through a channel, so the iterator can
        // yield freely while the worker keeps its try/catch.
        var channel = Channel.CreateUnbounded<ToolExecutionEvent>(new UnboundedChannelOptions { SingleReader = true, SingleWriter = true });
        var worker = RunAsync(tool, call, context, channel.Writer, cancellationToken);

        await foreach (var evt in channel.Reader.ReadAllAsync(cancellationToken))
        {
            yield return evt;
        }

        await worker;
    }

    private async Task RunAsync(
        ITool tool,
        AiStreamEvent.ToolCall call,
        ToolExecutionContext context,
        ChannelWriter<ToolExecutionEvent> writer,
        CancellationToken cancellationToken)
    {
        try
        {
            if (!await _access.CanUseAsync(tool, context.Access))
            {
                _logger.LogWarning("User {UserId} called tool {ToolId} without access", context.UserId, tool.Id);
                Complete(writer, ToolResult.Error("You are not permitted to use this tool."), ToolCallStatus.Error);
                return;
            }

            if (tool.Execution == ToolExecution.Client)
            {
                await RunClientAsync(call, context, writer, cancellationToken);
                return;
            }

            JsonDocument arguments;
            try
            {
                arguments = JsonDocument.Parse(string.IsNullOrWhiteSpace(call.ArgumentsJson) ? "{}" : call.ArgumentsJson);
            }
            catch (JsonException ex)
            {
                Complete(writer, ToolResult.Error($"Arguments are not valid JSON: {ex.Message}"), ToolCallStatus.Error);
                return;
            }

            using (arguments)
            {
                var invocation = new ToolInvocation(call.Id, arguments.RootElement, context);

                if (tool is IStreamingTool streaming)
                {
                    await RunStreamingAsync(streaming, invocation, writer, cancellationToken);
                }
                else if (tool is IConfirmableTool confirmable)
                {
                    await RunConfirmableAsync(confirmable, invocation, writer, cancellationToken);
                }
                else
                {
                    await RunServerAsync(tool, invocation, writer, cancellationToken);
                }
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // A cancelled run stops here; the model is never asked again.
            writer.TryComplete(new OperationCanceledException(cancellationToken));
            return;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing tool {ToolId}", tool.Id);
            Complete(writer, ToolResult.Error($"Error: {ex.Message}"), ToolCallStatus.Error);
        }
        finally
        {
            writer.TryComplete();
        }
    }

    private async Task RunServerAsync(ITool tool, ToolInvocation invocation, ChannelWriter<ToolExecutionEvent> writer, CancellationToken cancellationToken)
    {
        var result = await WithConsentAsync(() => tool.ExecuteAsync(invocation, cancellationToken), invocation, writer, cancellationToken);
        if (result != null)
        {
            Complete(writer, result, result.IsError ? ToolCallStatus.Error : ToolCallStatus.Completed);
        }
    }

    private async Task RunStreamingAsync(IStreamingTool tool, ToolInvocation invocation, ChannelWriter<ToolExecutionEvent> writer, CancellationToken cancellationToken)
    {
        // The tool owns its pauses; this only forwards them and applies the usual truncation to the end result.
        var completed = false;
        await foreach (var evt in tool.StreamAsync(invocation, cancellationToken).WithCancellation(cancellationToken))
        {
            if (evt is ToolExecutionEvent.Completed done)
            {
                Complete(writer, done.Result, done.Status);
                completed = true;
                break;
            }

            Emit(writer, evt);
        }

        if (!completed)
        {
            Complete(writer, ToolResult.Error("The tool ended without a result."), ToolCallStatus.Error);
        }
    }

    private async Task RunConfirmableAsync(IConfirmableTool tool, ToolInvocation invocation, ChannelWriter<ToolExecutionEvent> writer, CancellationToken cancellationToken)
    {
        // Building the preview may itself need a delegated token (looking up a recipient, say),
        // so it runs through the same consent handling as the commit.
        var preview = await WithConsentAsync(() => tool.PrepareAsync(invocation, cancellationToken), invocation, writer, cancellationToken);
        if (preview == null)
        {
            return;
        }

        Emit(writer, new ToolExecutionEvent.ConfirmationRequested(preview, _options.ConfirmationTimeout));

        var response = await _pending.WaitAsync(
            invocation.Context.UserId, invocation.Context.MessageId, invocation.ToolCallId,
            ToolCallStatus.AwaitingConfirmation, _options.ConfirmationTimeout, cancellationToken);

        if (response == null)
        {
            Complete(writer, ToolResult.Error("The user did not respond in time; the action was not performed."), ToolCallStatus.Timeout);
            return;
        }

        if (response.Decision != ToolCallDecision.Approve)
        {
            Complete(writer, ToolResult.Error("The user declined this action. Do not retry it."), ToolCallStatus.Rejected);
            return;
        }

        var approvedArguments = preview.AllowEdit && response.Payload is { ValueKind: JsonValueKind.Object } edited
            ? edited
            : invocation.Arguments;

        Emit(writer, new ToolExecutionEvent.StatusChanged(ToolCallStatus.Approved, approvedArguments.GetRawText()));

        var result = await WithConsentAsync(
            () => tool.CommitAsync(invocation, approvedArguments, cancellationToken), invocation, writer, cancellationToken);
        if (result != null)
        {
            Complete(writer, result, result.IsError ? ToolCallStatus.Error : ToolCallStatus.Completed);
        }
    }

    private async Task RunClientAsync(AiStreamEvent.ToolCall call, ToolExecutionContext context, ChannelWriter<ToolExecutionEvent> writer, CancellationToken cancellationToken)
    {
        Emit(writer, new ToolExecutionEvent.ClientCallRequested(call.ArgumentsJson, _options.ClientToolTimeout));

        var response = await _pending.WaitAsync(
            context.UserId, context.MessageId, call.Id,
            ToolCallStatus.AwaitingClient, _options.ClientToolTimeout, cancellationToken);

        if (response == null)
        {
            Complete(writer, ToolResult.Error("The client did not return a result in time."), ToolCallStatus.Timeout);
            return;
        }

        var content = response.Payload switch
        {
            { ValueKind: JsonValueKind.String } s => s.GetString() ?? string.Empty,
            { ValueKind: JsonValueKind.Undefined } or null => string.Empty,
            { } other => other.GetRawText()
        };

        var result = new ToolResult(content, content, response.IsError);
        Complete(writer, result, response.IsError ? ToolCallStatus.Error : ToolCallStatus.Completed);
    }

    /// <summary>
    /// Runs a tool step, pausing for consent when a downstream token is missing. Returns null
    /// when the call has ended inside this method (declined, timed out, or bad arguments); the
    /// completion has then already been written and the caller must stop.
    /// </summary>
    private async Task<T?> WithConsentAsync<T>(
        Func<Task<T>> action,
        ToolInvocation invocation,
        ChannelWriter<ToolExecutionEvent> writer,
        CancellationToken cancellationToken) where T : class
    {
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                return await action();
            }
            catch (ToolArgumentException ex)
            {
                Complete(writer, ToolResult.Error(ex.Message), ToolCallStatus.Error);
                return null;
            }
            catch (ConsentRequiredException ex) when (attempt < MaxConsentRetries)
            {
                Emit(writer, new ToolExecutionEvent.ConsentRequired(ex.Scopes, _options.ConsentTimeout));

                var response = await _pending.WaitAsync(
                    invocation.Context.UserId, invocation.Context.MessageId, invocation.ToolCallId,
                    ToolCallStatus.AwaitingConsent, _options.ConsentTimeout, cancellationToken);

                if (response == null)
                {
                    Complete(writer, ToolResult.Error("The user did not grant access in time."), ToolCallStatus.Timeout);
                    return null;
                }

                if (response.Decision != ToolCallDecision.Retry)
                {
                    Complete(writer, ToolResult.Error("The user declined to grant access. Do not retry."), ToolCallStatus.Rejected);
                    return null;
                }

                if (response.User != null)
                {
                    invocation.Context.Tokens.Refresh(response.User, response.IncomingToken);
                }

                Emit(writer, new ToolExecutionEvent.StatusChanged(ToolCallStatus.Running));
            }
            catch (ConsentRequiredException ex)
            {
                Complete(writer, ToolResult.Error($"Access was still not granted for: {string.Join(", ", ex.Scopes)}."), ToolCallStatus.Error);
                return null;
            }
        }
    }

    private void Complete(ChannelWriter<ToolExecutionEvent> writer, ToolResult result, ToolCallStatus status)
    {
        Emit(writer, new ToolExecutionEvent.Completed(Truncate(result), status));
    }

    private static void Emit(ChannelWriter<ToolExecutionEvent> writer, ToolExecutionEvent evt) => writer.TryWrite(evt);

    /// <summary>The model gets a bounded view of the output; the user keeps the whole thing.</summary>
    private ToolResult Truncate(ToolResult result)
    {
        var max = _options.MaxModelContentChars;
        if (max <= 0 || result.Content.Length <= max)
        {
            return result;
        }

        var cut = result.Content.Length - max;
        var content = $"{result.Content[..max]}\n...[truncated {cut} chars]";
        return result with { Content = content, Display = result.DisplayText };
    }
}
