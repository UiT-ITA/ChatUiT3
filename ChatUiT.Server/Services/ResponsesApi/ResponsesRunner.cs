using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Services.Agents;
using ChatUiT.Server.Services.AiProviders;
using ChatUiT.Server.Services.AiProviders.Protocols;
using ChatUiT.Server.Services.ApiCatalog;
using ChatUiT.Server.Services.Tools;
using Microsoft.Extensions.Logging;

namespace ChatUiT.Server.Services.ResponsesApi;

/// <summary>
/// Runs one Responses request on the provider conversation directly. Nothing is stored and nothing
/// waits in process: a server tool that needs the user ends the response with an approval request,
/// a client function call ends it with a <c>function_call</c>, and the next request continues from
/// the items the client sends back.
///
/// Order of work:
/// <list type="number">
/// <item>Answered approvals from the input are continued through <see cref="IToolExecutor.ResumeAsync"/>.
/// If one needs the user again, the response ends there.</item>
/// <item>Each model turn streams as reasoning and message items. Server calls run through the
/// executor in <see cref="InteractionMode.Defer"/> and become <c>mcp_call</c> items, or
/// <c>mcp_approval_request</c> when deferred. Client calls become <c>function_call</c> items.</item>
/// <item>Every call of a turn is processed before the response ends on pending client calls or
/// approvals; otherwise the results go back to the model for the next turn.</item>
/// </list>
/// </summary>
public sealed class ResponsesRunner
{
    private readonly IAiProviderRegistry _providers;
    private readonly IToolExecutor _executor;
    private readonly ItemSealer _sealer;
    private readonly ILogger<ResponsesRunner> _logger;

    public ResponsesRunner(IAiProviderRegistry providers, IToolExecutor executor, ItemSealer sealer, ILogger<ResponsesRunner> logger)
    {
        _providers = providers;
        _executor = executor;
        _sealer = sealer;
        _logger = logger;
    }

    /// <summary>Never throws for a failed run: the response ends as failed instead. Cancellation propagates.</summary>
    public async Task RunAsync(
        ApiTarget target,
        MappedRequest request,
        ToolExecutionContext context,
        ResponsesEventWriter writer,
        CancellationToken cancellationToken)
    {
        writer.Created();
        // Names, types and counts only: arguments, results and text carry the user's data.
        _logger.LogInformation("Response {ResponseId} on {Model} started: {InputItems} input items, {Resumes} resumed calls",
            writer.Response.Id, target.PublicId, request.History.Count, request.Resumes.Count);
        try
        {
            await RunCoreAsync(target, request, context, writer, cancellationToken);
            writer.Completed();
            _logger.LogInformation("Response {ResponseId} on {Model} completed with output [{Output}]",
                writer.Response.Id, target.PublicId, string.Join(", ", writer.Response.Output.Select(DescribeItem)));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation("Response {ResponseId} on {Model} cancelled by the client", writer.Response.Id, target.PublicId);
            throw;
        }
        catch (AiTurnFailedException ex)
        {
            // The provider's reason is safe to show and tells the client why the turn stopped.
            _logger.LogWarning("Response {ResponseId} on {Model} failed: the provider ended the turn early", writer.Response.Id, target.PublicId);
            writer.Failed(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Response {ResponseId} on {Model} failed", writer.Response.Id, target.PublicId);
            writer.Failed("The response could not be completed because an error occurred while generating it.");
        }
    }

    private async Task RunCoreAsync(
        ApiTarget target,
        MappedRequest request,
        ToolExecutionContext context,
        ResponsesEventWriter writer,
        CancellationToken cancellationToken)
    {
        var output = new OutputItems(target, writer, _sealer);

        var waiting = false;
        foreach (var resume in request.Resumes)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var call = new AiStreamEvent.ToolCall(resume.State.CallId, resume.State.Tool, resume.State.ArgumentsJson);
            var tool = request.ServerTools.FirstOrDefault(t => t.Id == resume.State.Tool);
            var displayArguments = resume.Input is ResumeInput.Commit commit
                ? commit.ApprovedArguments.GetRawText()
                : resume.State.ArgumentsJson;
            // A commit can run for a while and is announced first; a decline ends at once.
            var announce = resume.Input is ResumeInput.Commit;

            var result = tool == null
                ? output.CompleteWithError(call, $"Unknown tool: {call.FunctionName}")
                : await output.ExecuteServerCallAsync(
                    tool, call, _executor.ResumeAsync(tool, call, context, resume.Input, cancellationToken), announce, displayArguments);

            if (result == null)
            {
                waiting = true;
            }
            else
            {
                request.History[resume.Slot] = new AiInputItem.ToolResult(result.ToolCallId, result.Content, result.IsError);
            }
        }

        if (waiting)
        {
            return;
        }

        var aiRequest = new AiRequest
        {
            Model = target.Model,
            Endpoint = target.Endpoint,
            SystemPrompt = request.SystemPrompt,
            Messages = request.History.Select(item => item!).ToList(),
            Parameters = request.Parameters,
            Tools = [.. request.ServerTools, .. request.ClientTools]
        };

        var protocol = ApiProtocols.Require(target.Model);
        var conversation = _providers.For(target.Endpoint.EndpointType).StartConversation(aiRequest);

        for (var round = 0; ; round++)
        {
            // An agent's budget, as in a nested run: once it is spent the model gets one more
            // turn with tool calls switched off, so it has to answer.
            var rounds = request.RoundsSinceUserMessage + round;
            var allowToolCalls = request.MaxRounds is not { } maxRounds || rounds < maxRounds;

            var calls = await StreamTurnAsync(conversation, protocol, target, writer, allowToolCalls, cancellationToken);
            _logger.LogInformation("Response {ResponseId} round {Round}: model called [{Calls}]",
                writer.Response.Id, round, string.Join(", ", calls.Select(c => c.FunctionName)));
            if (calls.Count == 0)
            {
                return;
            }

            if (!allowToolCalls)
            {
                _logger.LogWarning("Stopping response {ResponseId} on {Model}: the model called tools after its budget of {Rounds} rounds ran out.",
                    writer.Response.Id, target.PublicId, request.MaxRounds);
                output.EmitMessage($"_{AiConversationRunner.ToolRoundLimitText}_");
                return;
            }

            var results = new List<AiToolResult>(calls.Count);

            foreach (var call in calls)
            {
                cancellationToken.ThrowIfCancellationRequested();

                if (request.ClientTools.Any(t => t.Id == call.FunctionName))
                {
                    output.EmitFunctionCall(call);
                    waiting = true;
                    continue;
                }

                var tool = request.ServerTools.FirstOrDefault(t => t.Id == call.FunctionName);
                if (tool == null)
                {
                    _logger.LogWarning("Model called unknown tool {ToolName} in response {ResponseId}", call.FunctionName, writer.Response.Id);
                    results.Add(output.CompleteWithError(call, $"Unknown tool: {call.FunctionName}"));
                    continue;
                }

                var result = await output.ExecuteServerCallAsync(
                    tool, call, _executor.ExecuteAsync(tool, call, context, cancellationToken),
                    announce: tool is not IConfirmableTool, call.ArgumentsJson);
                _logger.LogInformation("Response {ResponseId} server tool {Tool} -> {Outcome}",
                    writer.Response.Id, call.FunctionName, result == null ? "deferred" : result.IsError ? "error" : "ok");
                if (result == null)
                {
                    waiting = true;
                }
                else
                {
                    results.Add(result);
                }
            }

            if (waiting)
            {
                return;
            }

            conversation.AppendToolResults(results);
        }
    }

    private static string DescribeItem(ResponseItem item) => item switch
    {
        MessageItem message => $"message({message.Status})",
        McpCallItem mcp => $"mcp_call {mcp.Name}({mcp.Status})",
        FunctionCallItem function => $"function_call {function.Name}",
        McpApprovalRequestItem approval => $"mcp_approval_request {approval.Name}",
        _ => item.GetType().Name
    };

    /// <summary>Streams one model turn as reasoning and message items and returns its tool calls.</summary>
    private async Task<List<AiStreamEvent.ToolCall>> StreamTurnAsync(
        IAiConversation conversation,
        Models.ApiProtocol protocol,
        ApiTarget target,
        ResponsesEventWriter writer,
        bool allowToolCalls,
        CancellationToken cancellationToken)
    {
        var calls = new List<AiStreamEvent.ToolCall>();

        ReasoningItem? reasoning = null;
        var reasoningIndex = -1;
        var reasoningDone = false;
        StringBuilder? summary = null;

        MessageItem? message = null;
        var messageIndex = -1;
        var text = new StringBuilder();

        void OpenReasoning()
        {
            if (reasoning != null)
            {
                return;
            }

            reasoning = new ReasoningItem { Id = NewId("rs") };
            reasoningIndex = writer.AddItem(reasoning);
        }

        void CloseSummaryPart()
        {
            if (summary == null)
            {
                return;
            }

            writer.SummaryPartDone(reasoningIndex, reasoning!.Summary.Count - 1, summary.ToString());
            summary = null;
        }

        await foreach (var streamEvent in conversation.StreamTurnAsync(allowToolCalls, cancellationToken))
        {
            switch (streamEvent)
            {
                case AiStreamEvent.Thinking thinking when !string.IsNullOrEmpty(thinking.Delta) && !reasoningDone:
                    OpenReasoning();
                    if (summary == null)
                    {
                        summary = new StringBuilder();
                        reasoning!.Summary.Add(new SummaryText());
                        writer.SummaryPartAdded(reasoningIndex, reasoning.Summary.Count - 1);
                    }

                    summary.Append(thinking.Delta);
                    reasoning!.Summary[^1].Text = summary.ToString();
                    writer.SummaryTextDelta(reasoningIndex, reasoning.Summary.Count - 1, thinking.Delta);
                    break;

                case AiStreamEvent.ThinkingBreak:
                    CloseSummaryPart();
                    break;

                case AiStreamEvent.Text delta when !string.IsNullOrEmpty(delta.Delta):
                    CloseSummaryPart();
                    if (message == null)
                    {
                        (message, messageIndex) = OpenMessage(writer);
                    }

                    text.Append(delta.Delta);
                    writer.OutputTextDelta(messageIndex, delta.Delta);
                    break;

                case AiStreamEvent.ReasoningState state:
                    CloseSummaryPart();
                    OpenReasoning();
                    reasoning!.EncryptedContent = _sealer.SealReasoning(protocol, target.Model.Id, state.Payload);
                    writer.ItemDone(reasoningIndex);
                    reasoningDone = true;
                    break;

                case AiStreamEvent.ToolCall call:
                    calls.Add(call);
                    break;
            }
        }

        CloseSummaryPart();
        if (reasoning != null && !reasoningDone)
        {
            writer.ItemDone(reasoningIndex);
        }

        if (message != null)
        {
            CompleteMessage(writer, message, messageIndex, text.ToString());
        }

        return calls;
    }

    private static string NewId(string prefix) => $"{prefix}_{Guid.NewGuid():N}";

    /// <summary>Adds an assistant message item with an empty output text part; text deltas follow.</summary>
    private static (MessageItem Item, int Index) OpenMessage(ResponsesEventWriter writer)
    {
        var item = new MessageItem { Id = NewId("msg"), Role = "assistant", Status = "in_progress", Content = JsonSerializer.SerializeToElement(Array.Empty<object>()) };
        var index = writer.AddItem(item);
        writer.ContentPartAdded(index);
        return (item, index);
    }

    private static void CompleteMessage(ResponsesEventWriter writer, MessageItem item, int index, string text)
    {
        item.Content = JsonSerializer.SerializeToElement(new[] { new OutputTextPart { Text = text } }, ResponsesJson.Options);
        item.Status = "completed";
        writer.OutputTextDone(index, text);
        writer.ItemDone(index);
    }

    /// <summary>
    /// The output items of one response that do not come from streamed model text: server calls,
    /// client calls, approval requests and fixed messages.
    /// </summary>
    private sealed class OutputItems
    {
        private readonly ApiTarget _target;
        private readonly ResponsesEventWriter _writer;
        private readonly ItemSealer _sealer;

        public OutputItems(ApiTarget target, ResponsesEventWriter writer, ItemSealer sealer)
        {
            _target = target;
            _writer = writer;
            _sealer = sealer;
        }

        /// <summary>
        /// Runs a server call from its executor events. Returns the result for the model, or null
        /// when the call was deferred and an approval request now ends the response.
        /// </summary>
        /// <param name="announce">
        /// Add the <c>mcp_call</c> item before the tool runs. When the call then defers, the item
        /// ends as <c>incomplete</c> and the approval request carries the call on.
        /// </param>
        public async Task<AiToolResult?> ExecuteServerCallAsync(
            ITool tool,
            AiStreamEvent.ToolCall call,
            IAsyncEnumerable<ToolExecutionEvent> events,
            bool announce,
            string displayArguments)
        {
            var item = new McpCallItem { Id = call.Id, Name = tool.Id, Arguments = displayArguments, Status = "in_progress" };
            int? index = null;
            if (announce)
            {
                index = _writer.AddItem(item);
                _writer.McpCallInProgress(index.Value);
            }

            // Inner activity of an agent tool is progress on the announced item only: it is not
            // stored on the item and not accepted back as input.
            var innerSummaryIndex = -1;

            await foreach (var evt in events)
            {
                switch (evt)
                {
                    case ToolExecutionEvent.StatusChanged { ArgumentsJson: { } approved }:
                        item.Arguments = approved;
                        break;

                    case ToolExecutionEvent.InnerCallStarted inner when index is { } at:
                        _writer.McpCallInnerCall(at, inner.Name);
                        break;

                    case ToolExecutionEvent.InnerReasoningPartStarted when index is { } at:
                        _writer.McpCallSummaryPartAdded(at, ++innerSummaryIndex);
                        break;

                    case ToolExecutionEvent.InnerReasoningDelta delta when index is { } at && innerSummaryIndex >= 0:
                        _writer.McpCallSummaryTextDelta(at, innerSummaryIndex, delta.Delta);
                        break;

                    case ToolExecutionEvent.Completed completed:
                        Finish(item, index, completed.Result);
                        return new AiToolResult(call.Id, completed.Result.Content, completed.Result.IsError);

                    case ToolExecutionEvent.Deferred deferred:
                        if (index is { } announced)
                        {
                            item.Status = "incomplete";
                            _writer.ItemDone(announced);
                        }

                        EmitApprovalRequest(tool, call, deferred.Step);
                        return null;
                }
            }

            var missing = ToolResult.Error("The tool ended without a result.");
            Finish(item, index, missing);
            return new AiToolResult(call.Id, missing.Content, true);
        }

        /// <summary>A call that does not run: it ends at once as a failed <c>mcp_call</c> with <paramref name="message"/>.</summary>
        public AiToolResult CompleteWithError(AiStreamEvent.ToolCall call, string message)
        {
            var result = ToolResult.Error(message);
            Finish(new McpCallItem { Id = call.Id, Name = call.FunctionName, Arguments = call.ArgumentsJson }, null, result);
            return new AiToolResult(call.Id, result.Content, true);
        }

        public void EmitFunctionCall(AiStreamEvent.ToolCall call)
        {
            var arguments = string.IsNullOrWhiteSpace(call.ArgumentsJson) ? "{}" : call.ArgumentsJson;
            var item = new FunctionCallItem { Id = NewId("fc"), CallId = call.Id, Name = call.FunctionName, Arguments = string.Empty, Status = "in_progress" };
            var index = _writer.AddItem(item);
            item.Arguments = arguments;
            _writer.FunctionCallArguments(index, arguments, call.FunctionName);
            item.Status = "completed";
            _writer.ItemDone(index);
        }

        public void EmitMessage(string text)
        {
            var (item, index) = OpenMessage(_writer);
            _writer.OutputTextDelta(index, text);
            CompleteMessage(_writer, item, index, text);
        }

        private void Finish(McpCallItem item, int? index, ToolResult result)
        {
            item.Output = result.IsError ? null : result.Content;
            item.Error = result.IsError ? result.Content : null;
            item.Status = result.IsError ? "failed" : "completed";

            var at = index ?? _writer.AddItem(item);
            if (result.IsError)
            {
                _writer.McpCallFailed(at);
            }
            else
            {
                _writer.McpCallCompleted(at);
            }

            _writer.ItemDone(at);
        }

        /// <summary>
        /// The approval request's id is the sealed state that continues the call; the arguments
        /// shown are the ones the next step would use.
        /// </summary>
        private void EmitApprovalRequest(ITool tool, AiStreamEvent.ToolCall call, DeferredStep step)
        {
            McpApprovalRequestItem item;
            switch (step)
            {
                case DeferredStep.Confirmation confirmation:
                    var preview = confirmation.Preview;
                    var confirmationState = new ApprovalState(_target.PublicId, call.Id, tool.Id, call.ArgumentsJson, preview.AllowEdit);
                    item = new McpApprovalRequestItem
                    {
                        Id = _sealer.SealApproval(confirmationState),
                        Name = tool.Id,
                        Arguments = call.ArgumentsJson,
                        ChatuitKind = ResponsesJson.KindConfirmation,
                        ChatuitPreview = new ApprovalPreview
                        {
                            Title = preview.Title,
                            Summary = preview.Summary,
                            AllowEdit = preview.AllowEdit,
                            Fields = preview.Fields.Select(f => new ApprovalPreviewField { Label = f.Label, Value = f.Value, Multiline = f.Multiline }).ToList()
                        }
                    };
                    break;

                default:
                    throw new InvalidOperationException($"Unknown deferred step {step.GetType().Name}.");
            }

            var index = _writer.AddItem(item);
            _writer.ItemDone(index);
        }
    }
}
