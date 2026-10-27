using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record ReadFileArgs(
    [property: Description("driveId from search_files.")]
    string DriveId,
    [property: Description("itemId from search_files.")]
    string ItemId);

public sealed class ReadFileFunction : Tool<ReadFileArgs>
{
    private const long MaxBytes = 512 * 1024;
    private static readonly string[] Scopes = [M365Scopes.FilesReadWriteAll];

    private readonly GraphClient _graph;

    public ReadFileFunction(GraphClient graph) => _graph = graph;

    public override string Id => "read_file";
    public override string DisplayName => "Read file";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Read the content of a text-based file (txt, md, csv, json, xml, html, code) from OneDrive or SharePoint. Office documents and PDFs return metadata only.";
    public override IReadOnlyList<string> RequiredScopes => Scopes;

    protected override async Task<ToolResult> ExecuteAsync(ReadFileArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(args.DriveId) || string.IsNullOrWhiteSpace(args.ItemId))
        {
            return ToolResult.Error("driveId and itemId are required.");
        }

        var itemPath = $"drives/{Uri.EscapeDataString(args.DriveId.Trim())}/items/{Uri.EscapeDataString(args.ItemId.Trim())}";
        var item = await _graph.GetAsync(invocation.Context, $"{itemPath}?$select=id,name,size,webUrl,file,folder,lastModifiedDateTime", Scopes, ct);

        var name = item.Str("name") ?? string.Empty;
        var size = long.TryParse(item.Str("size"), out var s) ? s : 0;
        var mimeType = item.Str("file", "mimeType");
        var metadata = new { name, size, mimeType, lastModified = item.Str("lastModifiedDateTime"), webUrl = item.Str("webUrl") };

        if (item.TryGetProperty("folder", out _))
        {
            return ToolResult.Ok(new { metadata, content = (string?)null, note = "This item is a folder." });
        }

        if (!TextFiles.IsText(name, mimeType))
        {
            return ToolResult.Ok(new { metadata, content = (string?)null, note = "Content is not readable as text; share the web link instead." });
        }

        var content = await _graph.GetTextAsync(invocation.Context, $"{itemPath}/content", Scopes, MaxBytes, ct);
        var truncated = size > MaxBytes;

        return ToolResult.Ok(new { metadata, content, truncated });
    }
}
