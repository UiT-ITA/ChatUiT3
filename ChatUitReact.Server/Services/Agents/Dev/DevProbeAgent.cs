using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.Dev;

public sealed record DevEchoArgs(
    [property: Description("The text to echo back.")] string Text);

/// <summary>
/// Development only. Exercises the confirmation path of the Responses API through its
/// <c>dev_echo</c> function; no other exposed agent has a confirmable function.
/// </summary>
public sealed class DevProbeAgent : InternalAgent
{
    public override string Id => "dev_probe";

    public override string DisplayName => "Development probe";

    public override string Description => "Development only: calls dev_echo so confirmation, editing and rejection can be tested.";

    public override string SystemPrompt => """
        You are a test agent. When the user asks you to echo something, call dev_echo with exactly that text. After the call, report the echoed text you got back, or that the user declined. Otherwise answer briefly.
        """;

    public override IReadOnlyList<ITool> Functions { get; } = [new DevEchoFunction()];

    public override ToolAccessPolicy DefaultPolicy => ToolAccessPolicy.ForRoles(UserRole.Admin);

    public override int MaxRounds => 5;

    /// <summary>
    /// A confirmable function with no side effects: the preview and the commit both just echo the
    /// text, and the preview allows editing, so every confirmation path can be exercised without
    /// touching anything.
    /// </summary>
    private sealed class DevEchoFunction : ConfirmableTool<DevEchoArgs>
    {
        public override string Id => "dev_echo";

        public override string DisplayName => "Echo (development)";

        public override string Description => "Echoes the given text back after the user has approved it. Has no side effects.";

        protected override Task<ToolPreview> PrepareAsync(DevEchoArgs args, ToolInvocation invocation, CancellationToken cancellationToken)
            => Task.FromResult(new ToolPreview(
                "Echo text",
                "Nothing is changed; the approved text is returned to the model.",
                [new ToolPreviewField("Text", args.Text, Multiline: true)],
                AllowEdit: true));

        protected override Task<ToolResult> CommitAsync(DevEchoArgs args, ToolInvocation invocation, CancellationToken cancellationToken)
            => Task.FromResult(ToolResult.Ok(new { echo = args.Text }, display: args.Text));
    }
}
