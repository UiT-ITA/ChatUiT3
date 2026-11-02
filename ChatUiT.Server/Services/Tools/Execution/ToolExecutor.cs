using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.AiProviders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace ChatUiT.Server.Services.Tools;

public sealed class ToolExecutor : IToolExecutor
{
    private readonly IToolAccessService _access;
    private readonly ToolOptions _options;
    private readonly ILogger<ToolExecutor> _logger;

    public ToolExecutor(
        IToolAccessService access,
        IOptions<ToolOptions> options,
        ILogger<ToolExecutor> logger)
    {
        _access = access;
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
            if (context.EnforceToolAccess && !await _access.CanUseAsync(tool, context.Access))
            {
                _logger.LogWarning("User {UserId} called tool {ToolId} without access", context.UserId, tool.Id);
                Complete(writer, ToolResult.Error("You are not permitted to use this tool."), ToolCallStatus.Error);
                return;
            }

            if (tool.Execution == ToolExecution.Client)
            {
                if (resume == null)
                {
                    Emit(writer, new ToolExecutionEvent.Deferred(new DeferredStep.ClientCall()));
                }
                else
                {
                    CompleteClient(resume, writer);
                }

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
                else if (tool is IQuestionTool question)
                {
                    await RunQuestionAsync(question, invocation, writer, cancellationToken);
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

    private async Task RunServerAsync(ITool tool, ToolInvocation invocation, ChannelWriter<ToolExecutionEvent> writer, CancellationToken cancellationToken)
    {
        var result = await RunStepAsync(() => tool.ExecuteAsync(invocation, cancellationToken), writer);
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

            if (evt is ToolExecutionEvent.Deferred)
            {
                // An inner confirmation cannot be tied to the arguments a repeated inner run
                // would produce; the Responses API refuses to expose an agent with such a tool.
                Complete(writer, ToolResult.Error("This tool asked for a confirmation that cannot be resumed here."), ToolCallStatus.Error);
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
        var preview = await RunStepAsync(() => tool.PrepareAsync(invocation, cancellationToken), writer);
        if (preview != null)
        {
            Emit(writer, new ToolExecutionEvent.Deferred(new DeferredStep.Confirmation(preview)));
        }
    }

    private async Task RunQuestionAsync(IQuestionTool tool, ToolInvocation invocation, ChannelWriter<ToolExecutionEvent> writer, CancellationToken cancellationToken)
    {
        var questions = await RunStepAsync(() => tool.PrepareQuestionsAsync(invocation, cancellationToken), writer);
        if (questions != null)
        {
            Emit(writer, new ToolExecutionEvent.Deferred(new DeferredStep.Questions(questions)));
        }
    }

    /// <summary>Continues a call with the answer a later request brought.</summary>
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
                await CommitAsync(confirmable, invocation, commit.ApprovedArguments, writer, cancellationToken);
                return;

            case ResumeInput.Answers answers:
                if (tool is not IQuestionTool question)
                {
                    Complete(writer, ToolResult.Error($"{tool.Id} does not take an answer."), ToolCallStatus.Error);
                    return;
                }

                var result = await RunStepAsync(() => question.AnswerAsync(invocation, answers.Values, cancellationToken), writer);
                if (result != null)
                {
                    Complete(writer, result, result.IsError ? ToolCallStatus.Error : ToolCallStatus.Completed);
                }
                return;

            case ResumeInput.Declined:
                Complete(writer, tool is IQuestionTool
                    ? ToolResult.Error(NotAnsweredText)
                    : ToolResult.Error(DeclinedText), ToolCallStatus.Rejected);
                return;

            default:
                Complete(writer, ToolResult.Error($"{tool.Id} cannot continue with this answer."), ToolCallStatus.Error);
                return;
        }
    }

    /// <summary>Commits approved arguments: validated as an object here, then bound to the tool's argument type.</summary>
    private async Task CommitAsync(IConfirmableTool tool, ToolInvocation invocation, JsonElement approvedArguments, ChannelWriter<ToolExecutionEvent> writer, CancellationToken cancellationToken)
    {
        if (approvedArguments.ValueKind != JsonValueKind.Object)
        {
            Complete(writer, ToolResult.Error("The approved arguments are not a JSON object."), ToolCallStatus.Error);
            return;
        }

        var result = await RunStepAsync(() => tool.CommitAsync(invocation, approvedArguments, cancellationToken), writer);
        if (result != null)
        {
            Complete(writer, result, result.IsError ? ToolCallStatus.Error : ToolCallStatus.Completed);
        }
    }

    private void CompleteClient(ResumeInput resume, ChannelWriter<ToolExecutionEvent> writer)
    {
        switch (resume)
        {
            case ResumeInput.ClientResult result:
                Complete(writer, new ToolResult(result.Content, result.Content, result.IsError), result.IsError ? ToolCallStatus.Error : ToolCallStatus.Completed);
                return;

            case ResumeInput.Declined:
                Complete(writer, ToolResult.Error(DeclinedText), ToolCallStatus.Rejected);
                return;

            default:
                Complete(writer, ToolResult.Error("A client tool continues only with its result."), ToolCallStatus.Error);
                return;
        }
    }

    /// <summary>
    /// Runs a tool step. Returns null when the call has ended inside this method (bad arguments,
    /// or a delegated token the server could not get); the completion has then already been
    /// written and the caller must stop.
    /// </summary>
    private async Task<T?> RunStepAsync<T>(Func<Task<T>> action, ChannelWriter<ToolExecutionEvent> writer) where T : class
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
        catch (TokenUnavailableException ex)
        {
            // A missing grant is a fault in the app registration; the user is never asked to fix it.
            _logger.LogError(ex, "No delegated token for {Scopes}", string.Join(", ", ex.Scopes));
            Complete(writer, ToolResult.Error(
                $"The app could not get access to {string.Join(", ", ex.Scopes)}. This is a configuration error in the app registration that an administrator must fix; tell the user so and do not retry."),
                ToolCallStatus.Error);
            return null;
        }
    }

    /// <summary>What the model gets for a call the user said no to.</summary>
    public const string DeclinedText = "The user declined this action. Do not retry it.";

    public const string NotAnsweredText = "The user chose not to answer.";

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
