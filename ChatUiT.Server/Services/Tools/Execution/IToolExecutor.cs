using System.Collections.Generic;
using System.Threading;
using ChatUiT.Server.Services.AiProviders;

namespace ChatUiT.Server.Services.Tools;

/// <summary>
/// Runs one tool call. A call ends with exactly one <see cref="ToolExecutionEvent.Completed"/>, or
/// with one <see cref="ToolExecutionEvent.Deferred"/> when it needs the user or the client: nothing
/// waits in process, and the answer continues the call through <see cref="ResumeAsync"/>.
/// Never throws for a tool failure: every failure becomes a <see cref="ToolExecutionEvent.Completed"/>
/// with an error result, so the runner's loop stays free of exception handling. Cancellation
/// of the generation does propagate.
/// </summary>
public interface IToolExecutor
{
    IAsyncEnumerable<ToolExecutionEvent> ExecuteAsync(
        ITool tool,
        AiStreamEvent.ToolCall call,
        ToolExecutionContext context,
        CancellationToken cancellationToken);

    /// <summary>
    /// Continues a call that ended with <see cref="ToolExecutionEvent.Deferred"/>. <paramref name="call"/>
    /// carries the model's original arguments. Access is checked again, and the call may defer again.
    /// </summary>
    IAsyncEnumerable<ToolExecutionEvent> ResumeAsync(
        ITool tool,
        AiStreamEvent.ToolCall call,
        ToolExecutionContext context,
        ResumeInput input,
        CancellationToken cancellationToken);
}
