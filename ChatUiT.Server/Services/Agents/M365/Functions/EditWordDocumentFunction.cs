using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Agents.M365.Office;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public enum WordOperationType
{
    ReplaceText,
    SetParagraphText,
    InsertParagraph,
    DeleteParagraph,
    FormatText,
    AddComment,
    InsertTable,
    SetTableCell,
    InsertTableRows,
    DeleteTableRow
}

public enum WordInsertPosition
{
    Before,
    After
}

public sealed record WordOperation(
    [property: Description("replaceText: find → replace in one paragraph, or the whole document without paragraph. setParagraphText: replace a paragraph's text, optionally with a new style. insertParagraph: new paragraph before/after a paragraph or table, or at the end. deleteParagraph. formatText: bold/italic/underline on a paragraph or on find in it. addComment: comment on a paragraph or on find in it. insertTable: new table from rows before/after a paragraph or table, or at the end. setTableCell. insertTableRows: rows after row, or at the end. deleteTableRow.")]
    WordOperationType Type,
    [property: Description("Paragraph number pN from read_file.")]
    int? Paragraph,
    [property: Description("Table number tN from read_file.")]
    int? Table,
    [property: Description("Row number rN in the table.")]
    int? Row,
    [property: Description("Column number in the row, from 1.")]
    int? Column,
    [property: Description("Exact text to find, case-sensitive.")]
    string? Find,
    [property: Description("Replacement text for replaceText. An empty string deletes the found text.")]
    string? Replace,
    [property: Description("Text for setParagraphText, insertParagraph, setTableCell and addComment. \\n is a line break.")]
    string? Text,
    [property: Description("Paragraph style id, e.g. Normal, Title, Heading1, Heading2, Heading3, ListBullet, ListNumber, or another style listed by read_file.")]
    string? Style,
    [property: Description("before or after the paragraph or table. Defaults to after.")]
    WordInsertPosition? Position,
    bool? Bold,
    bool? Italic,
    bool? Underline,
    [property: Description("Cell texts, one list per row, for insertTable and insertTableRows.")]
    List<List<string>>? Rows);

public sealed record EditWordDocumentArgs(
    [property: Description("driveId from read_file.")]
    string DriveId,
    [property: Description("itemId from read_file.")]
    string ItemId,
    [property: Description("version from read_file. The edit is refused if the file changed since.")]
    string Version,
    [property: Description("The changes, applied in order. All numbers refer to the document as read_file returned it.")]
    List<WordOperation> Operations);

/// <summary>Edits a .docx file in OneDrive or SharePoint after the user has approved the changes.</summary>
public sealed class EditWordDocumentFunction : ConfirmableTool<EditWordDocumentArgs>
{
    private readonly GraphClient _graph;

    public EditWordDocumentFunction(GraphClient graph) => _graph = graph;

    public override string Id => "edit_word_document";
    public override string DisplayName => "Edit Word document";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Edit a Word document (.docx) in OneDrive or SharePoint: replace text, set, insert or delete paragraphs with styles and lists, bold/italic/underline, comments, and tables. Read it with read_file first and use its numbers and version. Put all changes for one request in one call. The user must approve it first. If they reject it, do not retry or change it.";
    public override IReadOnlyList<string> RequiredScopes => DriveSupport.Scopes;

    protected override async Task<ToolPreview> PrepareAsync(EditWordDocumentArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var loaded = await OfficeFiles.LoadAsync(_graph, invocation.Context, args.DriveId, args.ItemId, ".docx", args.Version, ct);
        var (bytes, changes) = WordDocuments.Apply(loaded.Bytes, args.Operations ?? [], Author(invocation));
        OfficeFiles.Remember(invocation, args, loaded, bytes, changes);

        return new ToolPreview(
            "Edit Word document",
            null,
            [new ToolPreviewField("Document", loaded.Name), new ToolPreviewField("Changes", OfficeFiles.Numbered(changes), Multiline: true)],
            AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(EditWordDocumentArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var prepared = OfficeFiles.Take(invocation, args);
        var loaded = prepared?.Loaded ?? await OfficeFiles.LoadAsync(_graph, invocation.Context, args.DriveId, args.ItemId, ".docx", args.Version, ct);
        var (bytes, changes) = prepared != null ? (prepared.Bytes, prepared.Changes) : WordDocuments.Apply(loaded.Bytes, args.Operations ?? [], Author(invocation));
        var item = await OfficeFiles.SaveAsync(_graph, invocation.Context, args.DriveId, args.ItemId, loaded, bytes, WordDocuments.MediaType, ct);

        return ToolResult.Ok(
            new { edited = true, name = loaded.Name, webUrl = item.Str("webUrl") ?? loaded.WebUrl, changes, note = "The numbers and version have changed. Read the document again before the next edit." },
            $"Edited {loaded.Name}.");
    }

    internal static string Author(ToolInvocation invocation) => invocation.Context.UserDisplayName ?? invocation.Context.UserPrincipalName ?? "ChatUiT";
}
