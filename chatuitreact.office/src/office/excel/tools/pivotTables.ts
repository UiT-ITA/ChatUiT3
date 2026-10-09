/* global Excel */

import {
  optionalString,
  optionalStringArray,
  requireObjectArray,
  requireOneOf,
  requireString,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { getRange, getSheet, parseAddress, runExcel } from "./shared";

const ACTIONS = ["create", "refresh", "delete"] as const;
const AGGREGATIONS = ["sum", "count", "average", "max", "min"] as const;
const SUMMARIZE_BY = { sum: "Sum", count: "Count", average: "Average", max: "Max", min: "Min" } as const;

interface DataField {
  field: string;
  aggregation: (typeof AGGREGATIONS)[number];
}

export const pivotTables: OfficeToolDefinition = {
  name: "excel_pivot_tables",
  description:
    "Pivot tables. create: name from source (a range with headers) or sourceTable (a table name), placed at " +
    "destination (a sheet-qualified top-left cell with room to grow), with rowFields, columnFields and dataFields " +
    "(field and aggregation, default sum). Fields are header names of the source. refresh: update pivot table " +
    "name from its source. delete: remove it. sheet narrows refresh and delete to one sheet. Pivot table names " +
    `and table names come from excel_get_overview.`,
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: [...ACTIONS] },
      name: { type: "string" },
      sheet: { type: "string" },
      source: { type: "string" },
      sourceTable: { type: "string" },
      destination: { type: "string", description: "For create, such as Summary!A3." },
      rowFields: { type: "array", items: { type: "string" } },
      columnFields: { type: "array", items: { type: "string" } },
      dataFields: {
        type: "array",
        items: {
          type: "object",
          properties: {
            field: { type: "string" },
            aggregation: { type: "string", enum: [...AGGREGATIONS] },
          },
          required: ["field"],
          additionalProperties: false,
        },
      },
    },
    required: ["action", "name"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const action = requireOneOf(args, "action", ACTIONS);
    const name = requireString(args, "name");
    if (action === "create") {
      const source = readSource(args);
      const destination = requireString(args, "destination");
      const rowFields = optionalStringArray(args, "rowFields") ?? [];
      const columnFields = optionalStringArray(args, "columnFields") ?? [];
      const dataFields = readDataFields(args);
      return runExcel(signal, async (context) => {
        const data =
          "address" in source ? getRange(context, source.address) : context.workbook.tables.getItem(source.table);
        const sheet = getSheet(context, parseAddress(destination).sheet).load("name");
        const pivot = sheet.pivotTables.add(name, data, getRange(context, destination));
        rowFields.forEach((field) => pivot.rowHierarchies.add(pivot.hierarchies.getItem(field)));
        columnFields.forEach((field) => pivot.columnHierarchies.add(pivot.hierarchies.getItem(field)));
        dataFields.forEach(({ field, aggregation }) => {
          pivot.dataHierarchies.add(pivot.hierarchies.getItem(field)).summarizeBy = SUMMARIZE_BY[aggregation];
        });
        pivot.load("name");
        await context.sync();
        return { pivotTable: pivot.name, sheet: sheet.name };
      });
    }

    const sheetName = optionalString(args, "sheet");
    return runExcel(signal, async (context) => {
      const pivot = pivotTableItem(context, name, sheetName);
      if (action === "refresh") {
        pivot.refresh();
      } else {
        pivot.delete();
      }
      await context.sync();
      return action === "refresh" ? { refreshed: name } : { deleted: name };
    });
  },
};

function pivotTableItem(context: Excel.RequestContext, name: string, sheet?: string): Excel.PivotTable {
  return sheet
    ? context.workbook.worksheets.getItem(sheet).pivotTables.getItem(name)
    : context.workbook.pivotTables.getItem(name);
}

function readSource(args: ToolArguments): { address: string } | { table: string } {
  const address = optionalString(args, "source");
  const table = optionalString(args, "sourceTable");
  if (address && !table) {
    return { address };
  }
  if (table && !address) {
    return { table };
  }
  throw new ToolArgumentError(`Give either "source" or "sourceTable".`);
}

function readDataFields(args: ToolArguments): DataField[] {
  if (args.dataFields === undefined || args.dataFields === null) {
    return [];
  }
  return requireObjectArray(args, "dataFields").map((item) => ({
    field: requireString(item, "field"),
    aggregation: item.aggregation === undefined ? "sum" : requireOneOf(item, "aggregation", AGGREGATIONS),
  }));
}
