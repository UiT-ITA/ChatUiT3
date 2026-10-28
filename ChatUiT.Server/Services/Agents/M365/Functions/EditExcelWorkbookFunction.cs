using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Agents.M365.Office;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public enum ExcelOperationType
{
    WriteRange,
    ClearRange,
    FormatRange,
    InsertRange,
    DeleteRange,
    AddSheet,
    RenameSheet,
    DeleteSheet,
    AddTable
}

public enum ExcelClearTarget
{
    All,
    Contents,
    Formats
}

public enum ExcelShift
{
    Down,
    Right,
    Up,
    Left
}

public sealed record ExcelOperation(
    [property: Description("writeRange: values from address (a top-left cell sizes it from values). clearRange. formatRange: bold, italic, fontColor, fillColor, numberFormat, autofitColumns. insertRange: insert cells, shift down/right. deleteRange: delete cells, shift up/left. addSheet: name. renameSheet: sheet → name. deleteSheet. addTable: a table over address, optionally named.")]
    ExcelOperationType Type,
    [property: Description("Sheet name.")]
    string? Sheet,
    [property: Description("A1-style cell or range, e.g. B2 or A1:D20. Whole columns like A:C work except for writeRange and numberFormat.")]
    string? Address,
    [property: Description("Cell contents, one list per row. Numbers, text, or formulas starting with =.")]
    List<List<string>>? Values,
    [property: Description("New sheet name for addSheet and renameSheet, or table name for addTable.")]
    string? Name,
    [property: Description("What clearRange removes. Defaults to all.")]
    ExcelClearTarget? ApplyTo,
    [property: Description("down or right for insertRange, up or left for deleteRange.")]
    ExcelShift? Shift,
    bool? Bold,
    bool? Italic,
    [property: Description("Font color, e.g. #C00000.")]
    string? FontColor,
    [property: Description("Fill color, e.g. #FFF2CC.")]
    string? FillColor,
    [property: Description("Excel number format, e.g. 0.00, # ##0 kr or dd.mm.yyyy.")]
    string? NumberFormat,
    [property: Description("Fit the column widths to their contents.")]
    bool? AutofitColumns,
    [property: Description("Whether the first row of addTable is headers. Defaults to true.")]
    bool? HasHeaders);

public sealed record EditExcelWorkbookArgs(
    [property: Description("driveId from read_file or search_files.")]
    string DriveId,
    [property: Description("itemId from read_file or search_files.")]
    string ItemId,
    [property: Description("The changes, applied in order.")]
    List<ExcelOperation> Operations);

/// <summary>Edits an .xlsx workbook in place through the Graph workbook API after the user has approved the changes.</summary>
public sealed class EditExcelWorkbookFunction : ConfirmableTool<EditExcelWorkbookArgs>
{
    private readonly GraphClient _graph;

    public EditExcelWorkbookFunction(GraphClient graph) => _graph = graph;

    public override string Id => "edit_excel_workbook";
    public override string DisplayName => "Edit Excel workbook";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => "Edit an Excel workbook (.xlsx) in OneDrive or SharePoint in place: write values and formulas, clear, format, insert and delete cells, add, rename and delete sheets, and add tables. Put all changes for one request in one call. The user must approve it first. If they reject it, do not retry or change it.";
    public override IReadOnlyList<string> RequiredScopes => DriveSupport.Scopes;

    protected override async Task<ToolPreview> PrepareAsync(EditExcelWorkbookArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var item = await _graph.GetAsync(invocation.Context, $"{DriveSupport.ItemPath(args.DriveId, args.ItemId)}?$select=name", DriveSupport.Scopes, ct);
        var name = item.Str("name") ?? string.Empty;
        if (!OfficeFiles.Is(name, ".xlsx"))
        {
            throw new ToolArgumentException($"{name} is not an .xlsx file.");
        }

        var changes = await ExcelWorkbooks.PreviewAsync(_graph, invocation.Context, ExcelWorkbooks.WorkbookPath(args.DriveId, args.ItemId), args.Operations ?? [], ct);
        return new ToolPreview(
            "Edit Excel workbook",
            null,
            [new ToolPreviewField("Workbook", name), new ToolPreviewField("Changes", OfficeFiles.Numbered(changes), Multiline: true)],
            AllowEdit: false);
    }

    protected override async Task<ToolResult> CommitAsync(EditExcelWorkbookArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        var changes = await ExcelWorkbooks.ApplyAsync(_graph, invocation.Context, ExcelWorkbooks.WorkbookPath(args.DriveId, args.ItemId), args.Operations ?? [], ct);
        return ToolResult.Ok(new { edited = true, changes }, "Edited the workbook.");
    }
}
