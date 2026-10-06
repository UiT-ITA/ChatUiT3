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
        var worker = RunAsync(tool, call, context, resume: null, channel.Writer, cancellationToken);

        await foreach (var evt in channel.Reader.ReadAllAsync(cancellationToken))
        {
            yield return evt;
        }

        await worker;
    }

    public async IAsyncEnumerable<ToolExecutionEvent> ResumeAsync(
        ITool tool,
        AiStreamEvent.ToolCall call,
        ToolExecutionContext context,
        ResumeInput input,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var channel = Channel.CreateUnbounded<ToolExecutionEvent>(new UnboundedChannelOptions { SingleReader = true, SingleWriter = true });
        var worker = RunAsync(tool, call, context, input, channel.Writer, cancellationToken);

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
        ResumeInput? resume,
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
                if (resume != null)
                {
                    Complete(writer, ToolResult.Error("A client tool call cannot be resumed."), ToolCallStatus.Error);
                    return;
                }

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

                if (resume != null)
                {
                    await ResumeCoreAsync(tool, invocation, resume, writer, cancellationToken);
                }
                else if (tool is IStreamingTool streaming)
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
        catch (AiTurnFailedException ex)
        {
            // A nested agent run the provider ended early. The protocol has already logged status,
            // reason and code; the reason is the call's result.
            _logger.LogWarning("Tool {ToolId} failed: the provider ended a nested turn early", tool.Id);
            Complete(writer, ToolResult.Error(ex.Message), ToolCallStatus.Error);
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

    private async Task RunServerAsync(ITool tool, ToolInvocation invocation, ChannelWriter<ToolExecutionEvent> writer, CancellationToken cancellationToken, int attempts = 0)
    {
        var result = await WithConsentAsync(() => tool.ExecuteAsync(invocation, cancellationToken), invocation, ConsentPhase.Run, null, attempts, writer, cancellationToken);
        if (result != null)
        {
            Complete(writer, result, result.IsError ? ToolCallStatus.Error : ToolCallStatus.Completed);
        }
    }

    /// <param name="attempts">
    /// Defer mode: consent requests already made for this call. A consent pause inside the tool
    /// ends the whole call, and after consent the call runs again from the start, so the count is
    /// kept here rather than by the inner step.
    /// </param>
    private async Task RunStreamingAsync(IStreamingTool tool, ToolInvocation invocation, ChannelWriter<ToolExecutionEvent> writer, CancellationToken cancellationToken, int attempts = 0)
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

            if (evt is ToolExecutionEvent.Deferred deferred)
            {
                completed = true;
                if (deferred.Step is not DeferredStep.Consent consent)
                {
                    // An inner confirmation cannot be tied to the arguments a repeated inner run
                    // would produce; the Responses API refuses to expose an agent with such a tool.
                    Complete(writer, ToolResult.Error("This tool asked for a confirmation that cannot be resumed here."), ToolCallStatus.Error);
                }
                else if (attempts >= MaxConsentRetries)
                {
                    Complete(writer, ToolResult.Error($"Access was still not granted for: {string.Join(", ", consent.Scopes)}."), ToolCallStatus.Error);
                }
                else
                {
                    Emit(writer, new ToolExecutionEvent.Deferred(new DeferredStep.Consent(consent.Scopes, ConsentPhase.Run, null, attempts + 1)));
                }

                break;
            }

            Emit(writer, evt);
        }

        if (!completed)
        {
            Complete(writer, ToolResult.Error("The tool ended without a result."), ToolCallStatus.Error);
        }
    }

    private async Task RunConfirmableAsync(IConfirmableTool tool, ToolInvocation invocation, ChannelWriter<ToolExecutionEvent> writer, CancellationToken cancellationToken, int prepareAttempts = 0)
    {
        // Building the preview may itself need a delegated token (looking up a recipient, say),
        // so it runs through the same consent handling as the commit.
        var preview = await WithConsentAsync(() => tool.PrepareAsync(invocation, cancellationToken), invocation, ConsentPhase.Prepare, null, prepareAttempts, writer, cancellationToken);
        if (preview == null)
        {
            return;
        }

        if (invocation.Context.Mode == InteractionMode.Defer)
        {
            Emit(writer, new ToolExecutionEvent.Deferred(new DeferredStep.Confirmation(preview)));
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
            () => tool.CommitAsync(invocation, approvedArguments, cancellationToken), invocation, ConsentPhase.Commit, approvedArguments, 0, writer, cancellationToken);
        if (result != null)
        {
            Complete(writer, result, result.IsError ? ToolCallStatus.Error : ToolCallStatus.Completed);
        }
    }

    /// <summary>Defer mode: continues a call with the answer a later request brought.</summary>
    private async Task ResumeCoreAsync(ITool tool, ToolInvocation invocation, ResumeInput resume, ChannelWriter<ToolExecutionEvent> writer, CancellationToken cancellationToken)
    {
        switch (resume)
        {
            case ResumeInput.Commit commit:
                if (tool is not IConfirmableTool confirmable)
                {
                    Complete(writer, ToolResult.Error($"{tool.Id} does not take a confirmation."), ToolCallStatus.Error);
                    return;
                }

                Emit(writer, new ToolExecutionEvent.StatusChanged(ToolCallStatus.Approved, commit.ApprovedArguments.GetRawText()));
                await CommitAsync(confirmable, invocation, commit.ApprovedArguments, 0, writer, cancellationToken);
                return;

            case ResumeInput.AfterConsent afterConsent:
                // The request that carried the consent also carries the new assertion; the
                // context's token provider was built from it.
                Emit(writer, new ToolExecutionEvent.StatusChanged(ToolCallStatus.Running));
                switch (afterConsent.Phase)
                {
                    case ConsentPhase.Commit when tool is IConfirmableTool confirmableTool && afterConsent.ApprovedArguments is { } approved:
                        await CommitAsync(confirmableTool, invocation, approved, afterConsent.Attempts, writer, cancellationToken);
                        return;
                    case ConsentPhase.Prepare when tool is IConfirmableTool confirmableTool:
                        await RunConfirmableAsync(confirmableTool, invocation, writer, cancellationToken, afterConsent.Attempts);
                        return;
                    case ConsentPhase.Run when tool is IStreamingTool streaming:
                        await RunStreamingAsync(streaming, invocation, writer, cancellationToken, afterConsent.Attempts);
                        return;
                    case ConsentPhase.Run when tool is not IConfirmableTool:
                        await RunServerAsync(tool, invocation, writer, cancellationToken, afterConsent.Attempts);
                        return;
                    default:
                        Complete(writer, ToolResult.Error($"{tool.Id} cannot continue from the {afterConsent.Phase} step."), ToolCallStatus.Error);
                        return;
                }

            case ResumeInput.Declined:
                Complete(writer, ToolResult.Error("The user declined this action. Do not retry it."), ToolCallStatus.Rejected);
                return;

            case ResumeInput.ConsentDeclined:
                Complete(writer, ToolResult.Error("The user declined to grant access. Do not retry."), ToolCallStatus.Rejected);
                return;
        }
    }

    /// <summary>Commits approved arguments: validated as an object here, then bound to the tool's argument type.</summary>
    private async Task CommitAsync(IConfirmableTool tool, ToolInvocation invocation, JsonElement approvedArguments, int attempts, ChannelWriter<ToolExecutionEvent> writer, CancellationToken cancellationToken)
    {
        if (approvedArguments.ValueKind != JsonValueKind.Object)
        {
            Complete(writer, ToolResult.Error("The approved arguments are not a JSON object."), ToolCallStatus.Error);
            return;
        }

        var result = await WithConsentAsync(
            () => tool.CommitAsync(invocation, approvedArguments, cancellationToken), invocation, ConsentPhase.Commit, approvedArguments, attempts, writer, cancellationToken);
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
    /// when the call has ended inside this method (declined, timed out, bad arguments, or in
    /// Defer mode handed to the client); the completion or deferral has then already been written
    /// and the caller must stop.
    /// </summary>
    /// <param name="phase">Defer mode: the step reported for repeating after consent.</param>
    /// <param name="approvedArguments">Defer mode, commit only: carried so the repeat commits the same arguments.</param>
    /// <param name="startAttempt">Consent requests already made for this step (Defer mode resumes); 0 in Wait mode.</param>
    private async Task<T?> WithConsentAsync<T>(
        Func<Task<T>> action,
        ToolInvocation invocation,
        ConsentPhase phase,
        JsonElement? approvedArguments,
        int startAttempt,
        ChannelWriter<ToolExecutionEvent> writer,
        CancellationToken cancellationToken) where T : class
    {
        for (var attempt = startAttempt; ; attempt++)
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
                if (invocation.Context.Mode == InteractionMode.Defer)
                {
                    // The arguments document is disposed when the call ends; the step outlives it.
                    Emit(writer, new ToolExecutionEvent.Deferred(new DeferredStep.Consent(ex.Scopes, phase, approvedArguments?.Clone(), attempt + 1)));
                    return null;
                }

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
