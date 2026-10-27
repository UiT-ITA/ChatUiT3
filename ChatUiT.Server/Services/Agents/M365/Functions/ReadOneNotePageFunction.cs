using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record ReadOneNotePageArgs(
    [property: Description("Page id from list_onenote_pages.")]
    string PageId);

public sealed class ReadOneNotePageFunction : Tool<ReadOneNotePageArgs>
{
    private const int MaxChars = 100_000;
    private const long MaxBytes = 2 * 1024 * 1024;
    private readonly GraphClient _graph;

    public ReadOneNotePageFunction(GraphClient graph) => _graph = graph;

    public override string Id => "read_onenote_page";
    public override string DisplayName => "Read OneNote page";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Read a OneNote page as HTML. Element id attributes are the targets for update_onenote_page.";
    public override IReadOnlyList<string> RequiredScopes => OneNoteSupport.ReadScopes;

    protected override async Task<ToolResult> ExecuteAsync(ReadOneNotePageArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var (_, onenote, pageId) = OneNoteSupport.Split(args.PageId, "pageId");
        var html = await _graph.GetTextAsync(invocation.Context,
            $"{onenote}/pages/{pageId}/content?includeIDs=true",
            OneNoteSupport.ReadScopes, MaxBytes, ct);

        var (content, truncated) = TextFiles.Cap(html, MaxChars);
        return ToolResult.Ok(new { pageId = args.PageId, html = content, truncated });
    }
}
