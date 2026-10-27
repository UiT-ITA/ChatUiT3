import {
  optionalBoolean,
  optionalInteger,
  optionalString,
  requireOneOf,
  requireString,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { capRange, cellMatrixSchema, getRange, MAX_CELLS, requireCellMatrix, runExcel } from "./shared";

const ACTIONS = ["create", "read", "add_rows", "set_style", "totals_row", "convert_to_range", "delete"] as const;

export const tables: OfficeToolDefinition = {
  name: "excel_tables",
  description:
    "Work with Excel tables. create: a table on address (hasHeaders default true; optional name and style). " +
    `read: the headers and data rows of table, at most ${MAX_CELLS} cells (truncated is true when there are ` +
    "more). add_rows: append values (rows the width of the table), or insert them at the 0-based data row index. " +
    "set_style: style, such as TableStyleMedium2 or TableStyleLight9. totals_row: show on or off. " +
    "convert_to_range: keep the cells, remove the table. delete: remove the table and its cells. Table names come " +
    `from excel_get_overview.`,
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: [...ACTIONS] },
      table: { type: "string", description: "The table name; every action but create needs it." },
      address: { type: "string", description: "For create: the range, including the header row." },
      hasHeaders: { type: "boolean" },
      name: { type: "string", description: "For create." },
      style: { type: "string", description: "For create and set_style." },
      values: { ...cellMatrixSchema, description: "For add_rows." },
      index: { type: "integer", minimum: 0, description: "For add_rows. Default: after the last row." },
      show: { type: "boolean", description: "For totals_row." },
    },
    required: ["action"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const action = requireOneOf(args, "action", ACTIONS);
    if (action === "create") {
      const address = requireString(args, "address");
      const hasHeaders = optionalBoolean(args, "hasHeaders") ?? true;
      const name = optionalString(args, "name");
      const style = optionalString(args, "style");
      return runExcel(signal, async (context) => {
        const table = context.workbook.tables.add(getRange(context, address), hasHeaders);
        if (name) {
          table.name = name;
        }
        if (style) {
          table.style = style;
        }
        table.load("name");
        const range = table.getRange().load("address");
        await context.sync();
        return { table: table.name, address: range.address };
      });
    }

    const tableName = requireString(args, "table");
    switch (action) {
      case "read":
        return runExcel(signal, async (context) => {
          const table = context.workbook.tables.getItem(tableName);
          const headers = table.getHeaderRowRange().load("values");
          const body = table.getDataBodyRange().load("address,rowCount,columnCount");
          await context.sync();
          const { range, truncated } = capRange(body);
          range.load("values");
          await context.sync();
          return {
            table: tableName,
            address: body.address,
            headers: headers.values[0],
            rowCount: body.rowCount,
            rows: range.values,
            truncated,
          };
        });
      case "add_rows": {
        const values = requireCellMatrix(args, "values");
        const index = optionalInteger(args, "index");
        if (index !== undefined && index < 0) {
          throw new ToolArgumentError(`"index" must be 0 or more.`);
        }
        return runExcel(signal, async (context) => {
          const added = context.workbook.tables.getItem(tableName).rows.add(index, values);
          const range = added.getRange().load("address");
          await context.sync();
          return { table: tableName, addedRows: values.length, address: range.address };
        });
      }
      case "set_style": {
        const style = requireString(args, "style");
        return runExcel(signal, async (context) => {
          context.workbook.tables.getItem(tableName).style = style;
          await context.sync();
          return { table: tableName, style };
        });
      }
      case "totals_row": {
        const show = optionalBoolean(args, "show");
        if (show === undefined) {
          throw new ToolArgumentError(`"show" is required for totals_row.`);
        }
        return runExcel(signal, async (context) => {
          context.workbook.tables.getItem(tableName).showTotals = show;
          await context.sync();
          return { table: tableName, showTotals: show };
        });
      }
      case "convert_to_range":
        return runExcel(signal, async (context) => {
          const range = context.workbook.tables.getItem(tableName).convertToRange().load("address");
          await context.sync();
          return { converted: tableName, address: range.address };
        });
      case "delete":
        return runExcel(signal, async (context) => {
          context.workbook.tables.getItem(tableName).delete();
          await context.sync();
          return { deleted: tableName };
        });
    }
  },
};
