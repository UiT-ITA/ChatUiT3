import type { OfficeToolDefinition } from "../../shared/officeTool";
import { loadSelectedRanges, runExcel } from "./shared";

export const getOverview: OfficeToolDefinition = {
  name: "excel_get_overview",
  description:
    "Get an overview of the open workbook: the sheets in order (name, position, visibility, the address of the " +
    "used range of cells with values, or null when empty), and per sheet its tables (name, address), charts (name, " +
    "type) and pivot tables (name); the named items (name, type, value); the active sheet and the selected " +
    "address (null when a chart, shape or other object is selected instead of cells).",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  handler: (_args, signal) =>
    runExcel(signal, async (context) => {
      const workbook = context.workbook;
      const sheets = workbook.worksheets;
      sheets.load("items/name,items/position,items/visibility");
      const active = sheets.getActiveWorksheet().load("name");
      const names = workbook.names;
      names.load("items/name,items/type,items/value");
      const tables = workbook.tables;
      tables.load("items/name,items/worksheet/name");
      await context.sync();

      const details = sheets.items.map((sheet) => {
        const used = sheet.getUsedRangeOrNullObject(true).load("address");
        const charts = sheet.charts;
        charts.load("items/name,items/chartType");
        const pivotTables = sheet.pivotTables;
        pivotTables.load("items/name");
        return { used, charts, pivotTables };
      });
      const tableRanges = tables.items.map((table) => table.getRange().load("address"));
      await context.sync();
      const selection = await loadSelectedRanges(context, "address");

      return {
        activeSheet: active.name,
        selection: selection?.address ?? null,
        sheets: sheets.items.map((sheet, index) => {
          const detail = details[index];
          return {
            name: sheet.name,
            position: sheet.position,
            visibility: sheet.visibility,
            usedRange: detail.used.isNullObject ? null : detail.used.address,
            tables: tables.items.flatMap((table, tableIndex) =>
              table.worksheet.name === sheet.name
                ? [{ name: table.name, address: tableRanges[tableIndex].address }]
                : []
            ),
            charts: detail.charts.items.map((chart) => ({ name: chart.name, type: chart.chartType })),
            pivotTables: detail.pivotTables.items.map((pivot) => pivot.name),
          };
        }),
        namedItems: names.items.map((item) => ({ name: item.name, type: item.type, value: item.value })),
      };
    }),
};
