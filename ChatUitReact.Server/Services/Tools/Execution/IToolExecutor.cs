using System.Collections.Generic;
using System.Threading;
using ChatUitReact.Server.Services.AiProviders;

namespace ChatUitReact.Server.Services.Tools;

/// <summary>
/// Runs one tool call from start to finish, including any pause for the user or the client.
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
}
