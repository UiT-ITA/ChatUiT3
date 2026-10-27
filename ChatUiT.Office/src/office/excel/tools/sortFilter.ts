/* global Excel */

import {
  optionalBoolean,
  optionalOneOf,
  optionalString,
  optionalStringArray,
  requireObjectArray,
  requireOneOf,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { getRange, getSheet, parseAddress, runExcel } from "./shared";

const ACTIONS = ["sort", "filter", "clear_filters"] as const;
const OPERATORS = ["And", "Or"] as const;

/** A column by 0-based index, or by header name. */
type Column = number | string;

type Target = { table: string } | { address: string };

interface SortKey {
  column: Column;
  ascending: boolean;
}

const columnSchema = {
  anyOf: [{ type: "integer", minimum: 0 }, { type: "string" }],
  description: "A 0-based column index within the table or range, or a header name.",
};

export const sortFilter: OfficeToolDefinition = {
  name: "excel_sort_filter",
  description:
    "Sort or filter a table (table) or a range (address). sort: by keys in order, each a column and ascending " +
    "(default true); for a range, hasHeaders keeps the first row in place. filter: one column, by values (show " +
    "only cells equal to one of them) or by criterion1, optional operator and criterion2 (such as >100, <=5, " +
    "=*text*). A range filter is the sheet's AutoFilter on that range, whose first row holds the headers. " +
    "clear_filters: the table's filters, or the AutoFilter of sheet (default the active sheet). Table names come " +
    `from excel_get_overview.`,
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: [...ACTIONS] },
      table: { type: "string" },
      address: { type: "string" },
      sheet: { type: "string", description: "For clear_filters without table." },
      keys: {
        type: "array",
        items: {
          type: "object",
          properties: { column: columnSchema, ascending: { type: "boolean" } },
          required: ["column"],
          additionalProperties: false,
        },
        description: "For sort.",
      },
      hasHeaders: { type: "boolean", description: "For sort of a range. Default false." },
      matchCase: { type: "boolean", description: "For sort." },
      column: { ...columnSchema, description: `For filter. ${columnSchema.description}` },
      values: { type: "array", items: { type: "string" }, description: "For filter: the values to show." },
      criterion1: { type: "string" },
      criterion2: { type: "string" },
      operator: { type: "string", enum: [...OPERATORS], description: "How criterion1 and criterion2 combine." },
    },
    required: ["action"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const action = requireOneOf(args, "action", ACTIONS);
    const table = optionalString(args, "table");
    const address = optionalString(args, "address");

    if (action === "clear_filters") {
      const sheet = optionalString(args, "sheet");
      return runExcel(signal, async (context) => {
        if (table) {
          context.workbook.tables.getItem(table).clearFilters();
        } else {
          getSheet(context, sheet).autoFilter.clearCriteria();
        }
        await context.sync();
        return { cleared: table ? { table } : { sheet: sheet ?? "active sheet" } };
      });
    }

    const target = readTarget(table, address);

    if (action === "sort") {
      const keys = readSortKeys(args);
      const matchCase = optionalBoolean(args, "matchCase") ?? false;
      const hasHeaders = optionalBoolean(args, "hasHeaders") ?? false;
      const needsNames = keys.some((key) => typeof key.column === "string");
      if ("address" in target && needsNames && !hasHeaders) {
        throw new ToolArgumentError("Column names need hasHeaders for a range; use column indexes otherwise.");
      }
      return runExcel(signal, async (context) => {
        if ("table" in target) {
          const item = context.workbook.tables.getItem(target.table);
          const headers = needsNames ? await tableHeaders(context, item) : [];
          item.sort.apply(sortFields(keys, headers), matchCase);
        } else {
          const range = getRange(context, target.address);
          const headers = needsNames ? await firstRow(context, range) : [];
          range.sort.apply(sortFields(keys, headers), matchCase, hasHeaders);
        }
        await context.sync();
        return { sorted: target, keys };
      });
    }

    const column = readColumn(args.column, "column");
    const criteria = readCriteria(args);
    const needsNames = typeof column === "string";
    return runExcel(signal, async (context) => {
      if ("table" in target) {
        const item = context.workbook.tables.getItem(target.table);
        const headers = needsNames ? await tableHeaders(context, item) : [];
        item.columns.getItemAt(columnIndex(column, headers)).filter.apply(criteria);
      } else {
        const range = getRange(context, target.address);
        const headers = needsNames ? await firstRow(context, range) : [];
        const sheet = getSheet(context, parseAddress(target.address).sheet);
        sheet.autoFilter.apply(range, columnIndex(column, headers), criteria);
      }
      await context.sync();
      return { filtered: target, column, criteria };
    });
  },
};

function readTarget(table: string | undefined, address: string | undefined): Target {
  if (table && !address) {
    return { table };
  }
  if (address && !table) {
    return { address };
  }
  throw new ToolArgumentError(`Give either "table" or "address".`);
}

function readColumn(value: unknown, name: string): Column {
  if ((typeof value === "number" && Number.isInteger(value) && value >= 0) || (typeof value === "string" && value)) {
    return value;
  }
  throw new ToolArgumentError(`"${name}" must be a 0-based column index or a header name.`);
}

function readSortKeys(args: ToolArguments): SortKey[] {
  const keys = requireObjectArray(args, "keys");
  if (keys.length === 0) {
    throw new ToolArgumentError(`"keys" must have at least one key.`);
  }
  return keys.map((key, index) => ({
    column: readColumn(key.column, `keys[${index}].column`),
    ascending: optionalBoolean(key, "ascending") ?? true,
  }));
}

function readCriteria(args: ToolArguments): Excel.FilterCriteria {
  const values = optionalStringArray(args, "values");
  const criterion1 = optionalString(args, "criterion1");
  const criterion2 = optionalString(args, "criterion2");
  const operator = optionalOneOf(args, "operator", OPERATORS);
  if (values !== undefined) {
    if (values.length === 0 || criterion1 !== undefined || criterion2 !== undefined) {
      throw new ToolArgumentError(`Give either a non-empty "values" or "criterion1".`);
    }
    return { filterOn: "Values", values };
  }
  if (!criterion1) {
    throw new ToolArgumentError(`filter needs "values" or "criterion1".`);
  }
  if (criterion2 !== undefined && operator === undefined) {
    throw new ToolArgumentError(`"operator" is required with "criterion2".`);
  }
  return { filterOn: "Custom", criterion1, ...(criterion2 !== undefined ? { criterion2, operator } : {}) };
}

async function tableHeaders(context: Excel.RequestContext, table: Excel.Table): Promise<string[]> {
  const tableColumns = table.columns.load("items/name");
  await context.sync();
  return tableColumns.items.map((item) => item.name);
}

async function firstRow(context: Excel.RequestContext, range: Excel.Range): Promise<string[]> {
  const row = range.getRow(0).load("values");
  await context.sync();
  return row.values[0].map(String);
}

function columnIndex(column: Column, headers: string[]): number {
  if (typeof column === "number") {
    return column;
  }
  const index = headers.indexOf(column);
  if (index < 0) {
    throw new Error(`Column "${column}" was not found. The headers are: ${headers.join(", ")}.`);
  }
  return index;
}

function sortFields(keys: SortKey[], headers: string[]): Excel.SortField[] {
  return keys.map((key) => ({ key: columnIndex(key.column, headers), ascending: key.ascending }));
}
