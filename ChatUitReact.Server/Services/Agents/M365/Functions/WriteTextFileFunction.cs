using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record WriteTextFileArgs(
    [property: Description("Path in the user's OneDrive, relative to the root, e.g. Notes/meeting-2026-09-22.md. Folders are created as needed.")]
    string Path,
    [property: Description("The full text content to write.")]
    string Content);

/// <summary>Creates or overwrites a text file in the user's OneDrive after approval.</summary>
public sealed class WriteTextFileFunction : ConfirmableTool<WriteTextFileArgs>
{
    private const int MaxChars = 200_000;
    private static readonly string[] Scopes = [M365Scopes.FilesReadWriteAll];
    private readonly GraphClient _graph;

    public WriteTextFileFunction(GraphClient graph) => _graph = graph;

    public override string Id => "write_text_file";
    public override string DisplayName => "Write text file";
    public override string Description => "Create or overwrite a text file (txt, md, csv, json, ...) in the user's OneDrive at the given path. The user must approve it first.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolPreview> PrepareAsync(WriteTextFileArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var path = Normalise(args.Path);
        if (args.Content.Length > MaxChars)
        {
            throw new ToolArgumentException($"content is longer than {MaxChars} characters.");
        }

        var exists = false;
        try
        {
            await _graph.GetAsync(invocation.Context, $"me/drive/root:/{EscapePath(path)}?$select=id", Scopes, ct);
            exists = true;
        }
        catch (GraphRequestException ex) when (ex.Status == HttpStatusCode.NotFound)
        {
        }

        var excerpt = args.Content.Length > 1500 ? args.Content[..1500] + "\n…" : args.Content;
        return new ToolPreview(
            exists ? "Overwrite file in OneDrive" : "Create file in OneDrive",
            exists ? "A file already exists at this path and will be replaced." : null,
            [new ToolPreviewField("Path", path), new ToolPreviewField("Content", excerpt, Multiline: true)],
            AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(WriteTextFileArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var path = Normalise(args.Path);
        var item = await _graph.PutTextAsync(invocation.Context, $"me/drive/root:/{EscapePath(path)}:/content", args.Content, "text/plain", Scopes, ct);
        return ToolResult.Ok(new { written = true, path, itemId = item.Str("id"), driveId = item.Str("parentReference", "driveId"), webUrl = item.Str("webUrl") }, $"Wrote {path}.");
    }

    private static string Normalise(string path)
    {
        var trimmed = (path ?? string.Empty).Replace('\\', '/').Trim().Trim('/');
        if (trimmed.Length == 0 || trimmed.Contains("..", StringComparison.Ordinal))
        {
            throw new ToolArgumentException("path must be a relative OneDrive path without '..'.");
        }

        return trimmed;
    }

    private static string EscapePath(string path) => string.Join('/', path.Split('/', StringSplitOptions.RemoveEmptyEntries).Select(Uri.EscapeDataString));
}
