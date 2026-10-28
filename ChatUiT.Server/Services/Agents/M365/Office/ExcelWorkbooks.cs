using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Services.Agents.M365.Functions;
using ChatUiT.Server.Services.Tools;
using DocumentFormat.OpenXml.Packaging;
using S = DocumentFormat.OpenXml.Spreadsheet;

namespace ChatUiT.Server.Services.Agents.M365.Office;

/// <summary>Reads and edits .xlsx files in place through the Graph workbook API.</summary>
public static class ExcelWorkbooks
{
    public const string MediaType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    public const string DefaultSheet = "Sheet1";
    public const int MaxRangeCells = 10_000;

    private const int OverviewRows = 100;
    private const int OverviewColumns = 30;
    private const int OverviewCells = 3_000;
    private const int OverviewConcurrency = 4;

    public static string WorkbookPath(string driveId, string itemId) => $"{DriveSupport.ItemPath(driveId, itemId)}/workbook";

    private static string SheetPath(string workbook, string sheet) => $"{workbook}/worksheets/{Uri.EscapeDataString(sheet)}";

    private static string RangePath(string workbook, string sheet, string address)
        => $"{SheetPath(workbook, sheet)}/range(address='{Uri.EscapeDataString(address.Replace("'", "''"))}')";

    /// <summary>Every sheet with its used range, tables and the first rows of its values. Sheets are read a few at a time.</summary>
    public static async Task<string> ReadOverviewAsync(GraphClient graph, ToolExecutionContext context, string workbook, CancellationToken ct)
    {
        var sheets = await graph.GetAsync(context, $"{workbook}/worksheets?$select=name,visibility", DriveSupport.Scopes, ct);
        using var gate = new SemaphoreSlim(OverviewConcurrency);
        var parts = await Task.WhenAll(sheets.Items().Select(async sheet =>
        {
            await gate.WaitAsync(ct);
            try
            {
                return await ReadSheetAsync(graph, context, workbook, sheet.Str("name") ?? string.Empty, sheet.Str("visibility"), ct);
            }
            finally
            {
                gate.Release();
            }
        }));

        var text = new StringBuilder();
        text.AppendLine("Excel workbook. Cells are shown as displayed. Use read_excel_range for other ranges or formulas, and edit_excel_workbook to change it.");
        foreach (var part in parts)
        {
            text.AppendLine();
            text.Append(part);
        }

        return text.ToString();
    }

    private static async Task<string> ReadSheetAsync(GraphClient graph, ToolExecutionContext context, string workbook, string name, string? visibility, CancellationToken ct)
    {
        var text = new StringBuilder();
        var header = $"Sheet \"{name}\"{(visibility is null or "Visible" ? string.Empty : $" ({visibility})")}";

        var usedTask = graph.GetAsync(context, $"{SheetPath(workbook, name)}/usedRange(valuesOnly=true)?$select=address", DriveSupport.Scopes, ct);
        var tablesTask = graph.GetAsync(context, $"{SheetPath(workbook, name)}/tables?$select=id,name", DriveSupport.Scopes, ct);
        await Task.WhenAll(usedTask, tablesTask);
        if (!CellRange.TryParse(usedTask.Result.Str("address"), out var range))
        {
            return $"{header}: empty\n";
        }

        var columns = Math.Min(range.Columns, OverviewColumns);
        var rows = Math.Min(Math.Min(range.Rows, OverviewRows), Math.Max(1, OverviewCells / columns));
        var shown = range.Resize(rows, columns);
        var valuesTask = graph.GetAsync(context, $"{RangePath(workbook, name, shown.ToString())}?$select=text", DriveSupport.Scopes, ct);
        var tables = tablesTask.Result.Items().ToList();
        var tableRanges = await Task.WhenAll(tables.Select(table =>
            graph.GetAsync(context, $"{workbook}/tables/{Uri.EscapeDataString(table.Str("id") ?? string.Empty)}/range?$select=address", DriveSupport.Scopes, ct)));

        var values = Grid(await valuesTask);
        if (range.IsSingleCell && string.IsNullOrEmpty(values.FirstOrDefault()?.FirstOrDefault()))
        {
            return $"{header}: empty\n";
        }

        text.AppendLine($"{header}: used range {range}{(shown == range ? string.Empty : $", showing {shown}")}");
        for (var i = 0; i < tables.Count; i++)
        {
            text.AppendLine($"Table \"{tables[i].Str("name")}\" at {LocalAddress(tableRanges[i].Str("address"))}");
        }

        AppendGrid(text, shown, values);
        return text.ToString();
    }

    /// <summary>The displayed text and formulas of a bounded range.</summary>
    public static async Task<object> ReadRangeAsync(GraphClient graph, ToolExecutionContext context, string workbook, string sheet, string address, CancellationToken ct)
    {
        if (!CellRange.TryParse(address, out var range))
        {
            throw new ToolArgumentException("address must be a cell or range such as B2 or A1:D20.");
        }

        if (range.Cells > MaxRangeCells)
        {
            throw new ToolArgumentException($"the range has more than {MaxRangeCells} cells; read a smaller range.");
        }

        var result = await graph.GetAsync(context, $"{RangePath(workbook, sheet, range.ToString())}?$select=text,formulas", DriveSupport.Scopes, ct);
        var text = new StringBuilder();
        AppendGrid(text, range, Grid(result));

        var formulas = Grid(result, "formulas")
            .SelectMany((row, r) => row.Select((value, c) => (value, r, c)))
            .Where(cell => cell.value?.StartsWith('=') == true)
            .Select(cell => $"{CellRange.ColumnName(range.FirstColumn + cell.c)}{range.FirstRow + cell.r}: {cell.value}")
            .ToList();

        return new { sheet, address = range.ToString(), cells = text.ToString(), formulas };
    }

    /// <summary>Checks the operations against the workbook's sheets and describes each one, with the current values of ranges that will be overwritten.</summary>
    public static async Task<List<string>> PreviewAsync(GraphClient graph, ToolExecutionContext context, string workbook, IReadOnlyList<ExcelOperation> operations, CancellationToken ct)
    {
        var (steps, existing) = await PlanAsync(graph, context, workbook, operations, ct);
        var changes = new List<string>();
        foreach (var step in steps)
        {
            var summary = step.Summary;
            if (step.Op.Type == ExcelOperationType.WriteRange && existing.Contains(step.Op.Sheet!) && step.Range is { } range)
            {
                var before = await graph.GetAsync(context, $"{RangePath(workbook, step.Op.Sheet!, range.ToString())}?$select=text", DriveSupport.Scopes, ct);
                var current = Grid(before);
                if (current.Any(row => row.Any(v => !string.IsNullOrEmpty(v))))
                {
                    summary += $"\n   Before: {Excerpt(current)}";
                }
            }

            changes.Add(summary);
        }

        return changes;
    }

    /// <summary>Runs the operations in order. A failure stops the run and says which operations were applied.</summary>
    public static async Task<List<string>> ApplyAsync(GraphClient graph, ToolExecutionContext context, string workbook, IReadOnlyList<ExcelOperation> operations, CancellationToken ct)
    {
        var (steps, _) = await PlanAsync(graph, context, workbook, operations, ct);
        for (var i = 0; i < steps.Count; i++)
        {
            try
            {
                await RunAsync(graph, context, workbook, steps[i], ct);
            }
            catch (GraphRequestException ex)
            {
                var applied = i == 0 ? "No operations were applied." : $"Operations 1–{i} were applied.";
                throw new ToolArgumentException($"{applied} Operation {i + 1} ({steps[i].Op.Type}) failed: {ex.Message}");
            }
        }

        return steps.Select(s => s.Summary).ToList();
    }

    /// <summary>An empty workbook with one sheet named <see cref="DefaultSheet"/>.</summary>
    public static byte[] Create()
    {
        using var stream = new MemoryStream();
        using (var document = SpreadsheetDocument.Create(stream, DocumentFormat.OpenXml.SpreadsheetDocumentType.Workbook))
        {
            var workbook = document.AddWorkbookPart();
            workbook.Workbook = new S.Workbook();
            var sheet = workbook.AddNewPart<WorksheetPart>();
            sheet.Worksheet = new S.Worksheet(new S.SheetData());

            var styles = workbook.AddNewPart<WorkbookStylesPart>();
            styles.Stylesheet = new S.Stylesheet(
                new S.Fonts(new S.Font(new S.FontSize { Val = 11 }, new S.FontName { Val = "Aptos Narrow" })) { Count = 1 },
                new S.Fills(
                    new S.Fill(new S.PatternFill { PatternType = S.PatternValues.None }),
                    new S.Fill(new S.PatternFill { PatternType = S.PatternValues.Gray125 }))
                { Count = 2 },
                new S.Borders(new S.Border(new S.LeftBorder(), new S.RightBorder(), new S.TopBorder(), new S.BottomBorder(), new S.DiagonalBorder())) { Count = 1 },
                new S.CellStyleFormats(new S.CellFormat { NumberFormatId = 0, FontId = 0, FillId = 0, BorderId = 0 }) { Count = 1 },
                new S.CellFormats(new S.CellFormat { NumberFormatId = 0, FontId = 0, FillId = 0, BorderId = 0, FormatId = 0 }) { Count = 1 },
                new S.CellStyles(new S.CellStyle { Name = "Normal", FormatId = 0, BuiltinId = 0 }) { Count = 1 });

            workbook.Workbook.Append(new S.Sheets(new S.Sheet { Id = workbook.GetIdOfPart(sheet), SheetId = 1, Name = DefaultSheet }));
        }

        return stream.ToArray();
    }

    private sealed record Step(ExcelOperation Op, CellRange? Range, string Summary);

    private static async Task<(List<Step> Steps, HashSet<string> Existing)> PlanAsync(GraphClient graph, ToolExecutionContext context, string workbook, IReadOnlyList<ExcelOperation> operations, CancellationToken ct)
    {
        if (operations.Count == 0)
        {
            throw new ToolArgumentException("operations must not be empty.");
        }

        var response = await graph.GetAsync(context, $"{workbook}/worksheets?$select=name", DriveSupport.Scopes, ct);
        var existing = response.Items().Select(s => s.Str("name") ?? string.Empty).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var sheets = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);

        var steps = new List<Step>();
        for (var i = 0; i < operations.Count; i++)
        {
            try
            {
                steps.Add(Plan(operations[i], sheets));
            }
            catch (ToolArgumentException ex)
            {
                throw new ToolArgumentException($"Operation {i + 1} ({operations[i].Type}): {ex.Message}");
            }
        }

        return (steps, existing);
    }

    private static Step Plan(ExcelOperation op, HashSet<string> sheets)
    {
        switch (op.Type)
        {
            case ExcelOperationType.AddSheet:
            {
                var name = OfficeFiles.Required(op.Name?.Trim(), "name");
                if (!sheets.Add(name))
                {
                    throw new ToolArgumentException($"sheet \"{name}\" already exists.");
                }

                return new Step(op, null, $"Add sheet \"{name}\"");
            }
            case ExcelOperationType.RenameSheet:
            {
                var sheet = Sheet(op, sheets);
                var name = OfficeFiles.Required(op.Name?.Trim(), "name");
                if (sheets.Contains(name) && !name.Equals(sheet, StringComparison.OrdinalIgnoreCase))
                {
                    throw new ToolArgumentException($"sheet \"{name}\" already exists.");
                }

                sheets.Remove(sheet);
                sheets.Add(name);
                return new Step(op, null, $"Rename sheet \"{sheet}\" to \"{name}\"");
            }
            case ExcelOperationType.DeleteSheet:
            {
                var sheet = Sheet(op, sheets);
                sheets.Remove(sheet);
                return new Step(op, null, $"Delete sheet \"{sheet}\"");
            }
        }

        var target = Sheet(op, sheets);
        var address = OfficeFiles.Required(op.Address?.Trim(), "address");
        var parsed = CellRange.TryParse(address, out var range) ? range : (CellRange?)null;
        var where = $"{target}!{parsed?.ToString() ?? address}";

        switch (op.Type)
        {
            case ExcelOperationType.WriteRange:
            {
                var values = op.Values is { Count: > 0 } v ? v : throw new ToolArgumentException("values is required.");
                var columns = values[0].Count;
                if (columns == 0 || values.Any(row => row.Count != columns))
                {
                    throw new ToolArgumentException("every row of values must have the same number of cells, at least one.");
                }

                if (parsed is not { } start)
                {
                    throw new ToolArgumentException("address must be a cell or range such as B2 or A1:D20.");
                }

                var write = start.IsSingleCell ? start.Resize(values.Count, columns) : start;
                if (write.Rows != values.Count || write.Columns != columns)
                {
                    throw new ToolArgumentException($"{write} is {write.Rows}×{write.Columns} cells but values is {values.Count}×{columns}. Give the top-left cell to size it from values.");
                }

                return new Step(op, write, $"Write {values.Count}×{columns} cells to {target}!{write}\n   {Excerpt(values)}");
            }
            case ExcelOperationType.ClearRange:
                return new Step(op, parsed, $"Clear {(op.ApplyTo ?? ExcelClearTarget.All).ToString().ToLowerInvariant()} in {where}");
            case ExcelOperationType.FormatRange:
            {
                var formats = new List<string>();
                if (op.Bold is bool bold)
                {
                    formats.Add(bold ? "bold" : "not bold");
                }

                if (op.Italic is bool italic)
                {
                    formats.Add(italic ? "italic" : "not italic");
                }

                if (!string.IsNullOrWhiteSpace(op.FontColor))
                {
                    formats.Add($"font color {op.FontColor}");
                }

                if (!string.IsNullOrWhiteSpace(op.FillColor))
                {
                    formats.Add($"fill {op.FillColor}");
                }

                if (!string.IsNullOrWhiteSpace(op.NumberFormat))
                {
                    formats.Add($"number format {op.NumberFormat}");
                }

                if (op.AutofitColumns == true)
                {
                    formats.Add("autofit columns");
                }

                if (formats.Count == 0)
                {
                    throw new ToolArgumentException("set at least one of bold, italic, fontColor, fillColor, numberFormat and autofitColumns.");
                }

                if (!string.IsNullOrWhiteSpace(op.NumberFormat) && (parsed is not { } bounded || bounded.Cells > MaxRangeCells))
                {
                    throw new ToolArgumentException($"numberFormat needs a cell or range such as B2 or A1:D20, of at most {MaxRangeCells} cells.");
                }

                return new Step(op, parsed, $"Format {where}: {string.Join(", ", formats)}");
            }
            case ExcelOperationType.InsertRange:
            {
                var shift = op.Shift ?? throw new ToolArgumentException("shift is required: down or right.");
                if (shift is not (ExcelShift.Down or ExcelShift.Right))
                {
                    throw new ToolArgumentException("shift must be down or right.");
                }

                return new Step(op, parsed, $"Insert cells at {where}, shifting {shift.ToString().ToLowerInvariant()}");
            }
            case ExcelOperationType.DeleteRange:
            {
                var shift = op.Shift ?? throw new ToolArgumentException("shift is required: up or left.");
                if (shift is not (ExcelShift.Up or ExcelShift.Left))
                {
                    throw new ToolArgumentException("shift must be up or left.");
                }

                return new Step(op, parsed, $"Delete cells {where}, shifting {shift.ToString().ToLowerInvariant()}");
            }
            case ExcelOperationType.AddTable:
                return new Step(op, parsed, $"Add table{(string.IsNullOrWhiteSpace(op.Name) ? string.Empty : $" \"{op.Name}\"")} at {where}{(op.HasHeaders == false ? " without headers" : " with headers")}");
            default:
                throw new ToolArgumentException("unknown operation type.");
        }
    }

    private static async Task RunAsync(GraphClient graph, ToolExecutionContext context, string workbook, Step step, CancellationToken ct)
    {
        var op = step.Op;
        var scopes = DriveSupport.Scopes;
        string Range() => RangePath(workbook, op.Sheet!, step.Range?.ToString() ?? op.Address!);

        switch (op.Type)
        {
            case ExcelOperationType.AddSheet:
                await graph.PostAsync(context, $"{workbook}/worksheets/add", new { name = op.Name }, scopes, ct);
                break;
            case ExcelOperationType.RenameSheet:
                await graph.PatchAsync(context, SheetPath(workbook, op.Sheet!), new { name = op.Name }, scopes, ct);
                break;
            case ExcelOperationType.DeleteSheet:
                await graph.DeleteAsync(context, SheetPath(workbook, op.Sheet!), scopes, ct);
                break;
            case ExcelOperationType.WriteRange:
                // Formulas take plain values too, and Excel reads each cell as if it were typed.
                await graph.PatchAsync(context, Range(), new { formulas = op.Values }, scopes, ct);
                break;
            case ExcelOperationType.ClearRange:
                await graph.PostAsync(context, $"{Range()}/clear", new { applyTo = (op.ApplyTo ?? ExcelClearTarget.All).ToString() }, scopes, ct);
                break;
            case ExcelOperationType.InsertRange:
                await graph.PostAsync(context, $"{Range()}/insert", new { shift = op.Shift!.Value.ToString() }, scopes, ct);
                break;
            case ExcelOperationType.DeleteRange:
                await graph.PostAsync(context, $"{Range()}/delete", new { shift = op.Shift!.Value.ToString() }, scopes, ct);
                break;
            case ExcelOperationType.FormatRange:
                var font = new Dictionary<string, object>();
                if (op.Bold is bool bold)
                {
                    font["bold"] = bold;
                }

                if (op.Italic is bool italic)
                {
                    font["italic"] = italic;
                }

                if (!string.IsNullOrWhiteSpace(op.FontColor))
                {
                    font["color"] = op.FontColor;
                }

                if (font.Count > 0)
                {
                    await graph.PatchAsync(context, $"{Range()}/format/font", font, scopes, ct);
                }

                if (!string.IsNullOrWhiteSpace(op.FillColor))
                {
                    await graph.PatchAsync(context, $"{Range()}/format/fill", new { color = op.FillColor }, scopes, ct);
                }

                if (!string.IsNullOrWhiteSpace(op.NumberFormat) && step.Range is { } range)
                {
                    var formats = Enumerable.Range(0, range.Rows).Select(_ => Enumerable.Repeat(op.NumberFormat, range.Columns).ToList()).ToList();
                    await graph.PatchAsync(context, Range(), new { numberFormat = formats }, scopes, ct);
                }

                if (op.AutofitColumns == true)
                {
                    await graph.PostAsync(context, $"{Range()}/format/autofitColumns", new { }, scopes, ct);
                }

                break;
            case ExcelOperationType.AddTable:
                var table = await graph.PostAsync(context, $"{SheetPath(workbook, op.Sheet!)}/tables/add",
                    new { address = $"{op.Sheet}!{step.Range?.ToString() ?? op.Address}", hasHeaders = op.HasHeaders ?? true }, scopes, ct);
                if (!string.IsNullOrWhiteSpace(op.Name) && table.Str("id") is { } id)
                {
                    await graph.PatchAsync(context, $"{workbook}/tables/{Uri.EscapeDataString(id)}", new { name = op.Name }, scopes, ct);
                }

                break;
        }
    }

    private static string Sheet(ExcelOperation op, HashSet<string> sheets)
    {
        var sheet = OfficeFiles.Required(op.Sheet?.Trim(), "sheet");
        return sheets.TryGetValue(sheet, out var actual)
            ? actual
            : throw new ToolArgumentException($"sheet \"{sheet}\" does not exist. Sheets: {string.Join(", ", sheets.Select(s => $"\"{s}\""))}.");
    }


    private static string LocalAddress(string? address)
        => address == null ? string.Empty : address[(address.LastIndexOf('!') + 1)..];

    private static List<List<string?>> Grid(JsonElement range, string property = "text")
        => range.ValueKind == JsonValueKind.Object && range.TryGetProperty(property, out var rows) && rows.ValueKind == JsonValueKind.Array
            ? rows.EnumerateArray().Select(row => row.EnumerateArray().Select(cell => cell.ValueKind switch
            {
                JsonValueKind.String => cell.GetString(),
                JsonValueKind.Null or JsonValueKind.Undefined => null,
                _ => cell.GetRawText()
            }).ToList()).ToList()
            : [];

    private static void AppendGrid(StringBuilder text, CellRange range, List<List<string?>> grid)
    {
        static string Cell(string? value) => (value ?? string.Empty).Replace("|", "\\|").Replace("\r", string.Empty).Replace("\n", "\\n");

        text.AppendLine($"    | {string.Join(" | ", Enumerable.Range(range.FirstColumn, range.Columns).Select(CellRange.ColumnName))}");
        for (var r = 0; r < grid.Count; r++)
        {
            text.AppendLine($"{range.FirstRow + r,4}| {string.Join(" | ", grid[r].Select(Cell))}");
        }
    }

    private static string Excerpt<T>(IEnumerable<IEnumerable<T>> rows)
    {
        var list = rows.ToList();
        var shown = list.Take(5).Select(row => string.Join(" | ", row));
        return RunText.Short(string.Join(" / ", shown), 400) + (list.Count > 5 ? $" … ({list.Count} rows)" : string.Empty);
    }
}
