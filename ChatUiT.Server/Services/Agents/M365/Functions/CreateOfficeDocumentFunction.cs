using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Agents.M365.Office;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record NewParagraph(
    [property: Description("Paragraph text. \\n is a line break.")]
    string Text,
    [property: Description("Normal, Title, Heading1, Heading2, Heading3, ListBullet or ListNumber. Defaults to Normal.")]
    string? Style);

public sealed record NewSlide(
    string? Title,
    [property: Description("Body text. Each line becomes a paragraph.")]
    string? Body,
    [property: Description("\"Title Slide\" or \"Title and Content\". Defaults to \"Title and Content\".")]
    string? Layout);

public sealed record CreateOfficeDocumentArgs(
    [property: Description("File name with the extension .docx, .xlsx or .pptx.")]
    string Name,
    [property: Description("Folder path in the user's OneDrive, e.g. Documents/Reports. Used when driveId is not given; defaults to the root.")]
    string? FolderPath,
    [property: Description("driveId of the folder (from search_files or list_folder), for SharePoint or another drive. Use with folderId.")]
    string? DriveId,
    [property: Description("itemId of the folder. Use with driveId.")]
    string? FolderId,
    [property: Description("Content of a .docx file.")]
    List<NewParagraph>? Paragraphs,
    [property: Description("Slides of a .pptx file.")]
    List<NewSlide>? Slides,
    [property: Description("Cells of a .xlsx file from A1 on Sheet1, one list per row. Numbers, text, or formulas starting with =.")]
    List<List<string>>? Values);

/// <summary>Creates a Word, Excel or PowerPoint file after the user has approved it. An existing file with the same name is never replaced.</summary>
public sealed class CreateOfficeDocumentFunction : ConfirmableTool<CreateOfficeDocumentArgs>
{
    private readonly GraphClient _graph;

    public CreateOfficeDocumentFunction(GraphClient graph) => _graph = graph;

    public override string Id => "create_office_document";
    public override string DisplayName => "Create Office document";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Create a new Word (.docx), Excel (.xlsx) or PowerPoint (.pptx) file in the user's OneDrive or a SharePoint folder, optionally with content. Fails if a file with the name exists. The user must approve it first. If they reject it, do not retry or change it.";
    public override IReadOnlyList<string> RequiredScopes => DriveSupport.Scopes;

    protected override async Task<ToolPreview> PrepareAsync(CreateOfficeDocumentArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var (kind, name) = Validate(args);
        Build(kind, args);

        var location = string.IsNullOrWhiteSpace(args.DriveId)
            ? $"OneDrive/{(string.IsNullOrWhiteSpace(args.FolderPath) ? string.Empty : DriveSupport.Normalise(args.FolderPath))}"
            : (await _graph.GetAsync(invocation.Context, $"{DriveSupport.ItemPath(args.DriveId, args.FolderId ?? string.Empty)}?$select=name,webUrl", DriveSupport.Scopes, ct)).Str("webUrl") ?? string.Empty;

        var fields = new List<ToolPreviewField> { new("Folder", location), new("Name", name) };
        var content = Content(kind, args);
        if (content.Length > 0)
        {
            fields.Add(new ToolPreviewField("Content", content, Multiline: true));
        }

        return new ToolPreview($"Create {kind} file", null, fields, AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(CreateOfficeDocumentArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var (kind, name) = Validate(args);
        var (bytes, mediaType) = Build(kind, args);

        var parent = string.IsNullOrWhiteSpace(args.DriveId)
            ? $"me/drive/root:/{(string.IsNullOrWhiteSpace(args.FolderPath) ? string.Empty : DriveSupport.EscapePath(DriveSupport.Normalise(args.FolderPath)) + "/")}"
            : $"{DriveSupport.ItemPath(args.DriveId, args.FolderId ?? string.Empty)}:/";
        var item = await _graph.SendBytesAsync(invocation.Context, HttpMethod.Put,
            $"{parent}{Uri.EscapeDataString(name)}:/content?@microsoft.graph.conflictBehavior=fail", bytes, mediaType, DriveSupport.Scopes, ct);

        var driveId = item.Str("parentReference", "driveId") ?? string.Empty;
        var itemId = item.Str("id") ?? string.Empty;
        string? valuesError = null;
        if (kind == "Excel" && args.Values is { Count: > 0 } values)
        {
            try
            {
                await ExcelWorkbooks.ApplyAsync(_graph, invocation.Context, ExcelWorkbooks.WorkbookPath(driveId, itemId),
                    [new ExcelOperation(ExcelOperationType.WriteRange, ExcelWorkbooks.DefaultSheet, "A1", values, null, null, null, null, null, null, null, null, null, null)], ct);
            }
            catch (ToolArgumentException ex)
            {
                valuesError = $"The file was created, but the values were not written: {ex.Message}";
            }
        }

        return ToolResult.Ok(new { created = true, name, driveId, itemId, webUrl = item.Str("webUrl"), valuesError }, $"Created {name}.");
    }

    private static (string Kind, string Name) Validate(CreateOfficeDocumentArgs args)
    {
        var name = (args.Name ?? string.Empty).Trim();
        if (name.Length == 0 || name.IndexOfAny(['/', '\\']) >= 0)
        {
            throw new ToolArgumentException("name must be a file name without folders.");
        }

        if (string.IsNullOrWhiteSpace(args.DriveId) != string.IsNullOrWhiteSpace(args.FolderId))
        {
            throw new ToolArgumentException("driveId and folderId go together.");
        }

        var kind = Path.GetExtension(name).ToLowerInvariant() switch
        {
            ".docx" => "Word",
            ".xlsx" => "Excel",
            ".pptx" => "PowerPoint",
            _ => throw new ToolArgumentException("name must end in .docx, .xlsx or .pptx.")
        };

        if ((args.Paragraphs is { Count: > 0 } && kind != "Word")
            || (args.Slides is { Count: > 0 } && kind != "PowerPoint")
            || (args.Values is { Count: > 0 } && kind != "Excel"))
        {
            throw new ToolArgumentException("paragraphs are for .docx, slides for .pptx and values for .xlsx.");
        }

        if (args.Values is { Count: > 0 } values && (values[0].Count == 0 || values.Any(row => row.Count != values[0].Count)))
        {
            throw new ToolArgumentException("every row of values must have the same number of cells, at least one.");
        }

        return (kind, name);
    }

    private static (byte[] Bytes, string MediaType) Build(string kind, CreateOfficeDocumentArgs args) => kind switch
    {
        "Word" => (WordDocuments.Create(args.Paragraphs), WordDocuments.MediaType),
        "PowerPoint" => (PowerPointPresentations.Create(args.Slides), PowerPointPresentations.MediaType),
        _ => (ExcelWorkbooks.Create(), ExcelWorkbooks.MediaType)
    };

    private static string Content(string kind, CreateOfficeDocumentArgs args)
    {
        IEnumerable<string> lines = kind switch
        {
            "Word" => (args.Paragraphs ?? []).Select(p => $"{(string.IsNullOrWhiteSpace(p.Style) ? string.Empty : $"[{p.Style}] ")}{p.Text}"),
            "PowerPoint" => (args.Slides ?? []).Select((s, i) => $"Slide {i + 1}: {s.Title}{(string.IsNullOrEmpty(s.Body) ? string.Empty : $"\n   {s.Body.Replace("\n", "\n   ")}")}"),
            _ => (args.Values ?? []).Select(row => string.Join(" | ", row))
        };

        var text = string.Join("\n", lines);
        return text.Length > 3000 ? text[..3000] + "\n…" : text;
    }
}
