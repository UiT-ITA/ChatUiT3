using System.Collections.Generic;
using System.ComponentModel;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using ChatUitReact.Server.Models;
using ChatUitReact.Server.Services.Tools;

namespace ChatUitReact.Server.Services.Agents.M365.Functions;

public sealed record CreateOneNotePageArgs(
    [property: Description("Section id from list_onenote_sections.")]
    string SectionId,
    [property: Description("Page title.")]
    string Title,
    [property: Description("Page content as simple HTML (p, h1-h6, ul, ol, li, table, b, i, a).")]
    string Html);

/// <summary>Creates a OneNote page after the user has approved it.</summary>
public sealed class CreateOneNotePageFunction : ConfirmableTool<CreateOneNotePageArgs>
{
    private readonly GraphClient _graph;

    public CreateOneNotePageFunction(GraphClient graph) => _graph = graph;

    public override string Id => "create_onenote_page";
    public override string DisplayName => "Create OneNote page";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Create a page in a OneNote section from simple HTML. The user must approve it first. If they reject it, do not retry or change it.";
    public override IReadOnlyList<string> RequiredScopes => OneNoteSupport.WriteScopes;

    protected override async Task<ToolPreview> PrepareAsync(CreateOneNotePageArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var section = await _graph.GetAsync(invocation.Context, $"{SectionPath(args)}?$select=displayName", OneNoteSupport.WriteScopes, ct);
        return new ToolPreview(
            "Create OneNote page",
            null,
            [new ToolPreviewField("Section", section.Str("displayName") ?? ""), new ToolPreviewField("Title", args.Title), new ToolPreviewField("Content", args.Html, Multiline: true)],
            AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(CreateOneNotePageArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var html = $"<!DOCTYPE html><html><head><title>{WebUtility.HtmlEncode(args.Title.Trim())}</title></head><body>{args.Html}</body></html>";
        var page = await _graph.SendTextAsync(invocation.Context, HttpMethod.Post, $"{SectionPath(args)}/pages", html, "text/html", OneNoteSupport.WriteScopes, ct);
        var (root, _, _) = OneNoteSupport.Split(args.SectionId, "sectionId");
        return ToolResult.Ok(new { created = true, pageId = OneNoteSupport.Id(root, page.Str("id")!), webUrl = page.Str("links", "oneNoteWebUrl", "href") }, "Page created.");
    }

    private static string SectionPath(CreateOneNotePageArgs args)
    {
        if (string.IsNullOrWhiteSpace(args.Title) || string.IsNullOrWhiteSpace(args.Html))
        {
            throw new ToolArgumentException("title and html are required.");
        }

        var (_, onenote, sectionId) = OneNoteSupport.Split(args.SectionId, "sectionId");
        return $"{onenote}/sections/{sectionId}";
    }
}
