using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;

namespace ChatUiT.Server.Services.Tools;

public sealed record LoadToolsArgs(
    [property: Description("Ids of the toolboxes to load, as listed in this function's description.")]
    List<string> Toolboxes);

/// <summary>
/// Loads toolboxes into a chat. Built per request for the assistant the chat runs on, so it is
/// not in the registry. It is the one tool a chat with toolboxes always has. It offers the
/// assistant's top-level toolboxes; loading one makes its tools and those of its selected
/// children callable from the result on (<see cref="ToolResult.LoadedToolIds"/>), which
/// each protocol turns into tool definitions at that point of the conversation.
/// </summary>
public sealed class LoadToolsTool : Tool<LoadToolsArgs>
{
    public const string ToolId = "load_tools";

    private readonly IReadOnlyList<ResolvedToolbox> _offered;
    private readonly IToolAccessService? _access;
    private readonly HashSet<string> _loaded;

    /// <param name="offered">The assistant's top-level toolboxes this user may load, with the tools of their selected children, in a stable order.</param>
    /// <param name="loadedToolIds">Tools loaded earlier in the chat.</param>
    /// <param name="access">Checks each toolbox again when it is loaded. Null for assistants that do not enforce policies.</param>
    public LoadToolsTool(IReadOnlyList<ResolvedToolbox> offered, IEnumerable<string> loadedToolIds, IToolAccessService? access)
    {
        _offered = offered;
        _access = access;
        _loaded = new HashSet<string>(loadedToolIds, StringComparer.Ordinal);
        Description = BuildDescription(offered);
    }

    public override string Id => ToolId;

    public override string DisplayName => "Load tools";
    public override DataClassification Classification => DataClassification.Red;

    public override string Description { get; }

    private static string BuildDescription(IReadOnlyList<ResolvedToolbox> offered)
    {
        var text = new StringBuilder(
            "Loads toolboxes into this conversation. Their functions can be called from the result on and stay loaded for the rest of the conversation. " +
            "Load every toolbox you expect to need in this conversation as early as possible, in one call: what is loaded early is cached and costs less on every later message. " +
            "Toolboxes:");
        foreach (var toolbox in offered.Select(o => o.Toolbox))
        {
            text.Append($"\n- {toolbox.Id}: {toolbox.Description}");
        }

        return text.ToString();
    }

    protected override async Task<ToolResult> ExecuteAsync(LoadToolsArgs args, ToolInvocation invocation, CancellationToken cancellationToken)
    {
        var loaded = new List<object>();
        var loadedNames = new List<string>();
        var alreadyLoaded = new List<string>();
        var refused = new List<object>();
        var newToolIds = new List<string>();

        foreach (var id in (args.Toolboxes ?? []).Select(id => id?.Trim() ?? string.Empty).Distinct(StringComparer.Ordinal))
        {
            var offered = _offered.FirstOrDefault(o => o.Toolbox.Id == id);
            if (offered == null)
            {
                refused.Add(new { toolbox = id, reason = "Not one of this assistant's toolboxes." });
                continue;
            }

            if (_access != null && !await _access.CanUseAsync(offered.Toolbox, invocation.Context.Access))
            {
                refused.Add(new { toolbox = id, reason = "You are not permitted to use this toolbox." });
                continue;
            }

            var added = offered.Tools.Select(t => t.Id).Where(_loaded.Add).ToList();
            if (added.Count == 0)
            {
                alreadyLoaded.Add(id);
                continue;
            }

            newToolIds.AddRange(added);
            loaded.Add(new { toolbox = id, functions = added });
            loadedNames.Add(offered.Toolbox.DisplayName);
        }

        var display = loadedNames.Count > 0 ? string.Join(", ", loadedNames) : "Nothing new loaded";

        var result = ToolResult.Ok(new { loaded, alreadyLoaded, refused }, display);
        return result with { IsError = loaded.Count == 0 && alreadyLoaded.Count == 0, LoadedToolIds = newToolIds };
    }
}
