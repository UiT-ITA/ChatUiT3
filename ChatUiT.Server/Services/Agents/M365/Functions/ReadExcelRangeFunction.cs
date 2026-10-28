using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.Agents.M365.Office;
using ChatUiT.Server.Services.Tools;

namespace ChatUiT.Server.Services.Agents.M365.Functions;

public sealed record ReadExcelRangeArgs(
    [property: Description("driveId from read_file or search_files.")]
    string DriveId,
    [property: Description("itemId from read_file or search_files.")]
    string ItemId,
    [property: Description("Sheet name.")]
    string Sheet,
    [property: Description("A1-style cell or range, e.g. A1:H200.")]
    string Address);

public sealed class ReadExcelRangeFunction : Tool<ReadExcelRangeArgs>
{
    private readonly GraphClient _graph;

    public ReadExcelRangeFunction(GraphClient graph) => _graph = graph;

    public override string Id => "read_excel_range";
    public override string DisplayName => "Read Excel range";
    public override DataClassification Classification => DataClassification.Red;
    public override string Description => $"Read a range of an Excel workbook (.xlsx) in OneDrive or SharePoint: the cells as displayed and their formulas. At most {ExcelWorkbooks.MaxRangeCells} cells. read_file gives an overview of all sheets first.";
    public override IReadOnlyList<string> RequiredScopes => DriveSupport.Scopes;

    protected override async Task<ToolResult> ExecuteAsync(ReadExcelRangeArgs args, ToolInvocation invocation, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(args.Sheet))
        {
            return ToolResult.Error("sheet is required.");
        }

        var range = await ExcelWorkbooks.ReadRangeAsync(_graph, invocation.Context, ExcelWorkbooks.WorkbookPath(args.DriveId, args.ItemId), args.Sheet.Trim(), args.Address, ct);
        return ToolResult.Ok(range);
    }
}
