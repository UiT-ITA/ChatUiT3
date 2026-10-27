/* global AbortSignal, Excel, OfficeExtension */

import { ToolArgumentError } from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";
import type { ErrorHints } from "../../shared/officeError";
import { runBatch } from "../../shared/runBatch";

/** Said when the selection is a chart, shape or other object instead of cells. */
export const NOT_CELLS = "The selection is not cells; the user has selected a chart, shape or other object.";

/**
 * The selected cells with `properties` loaded, or null when the selection is not cells, which Excel
 * reports as InvalidSelection. Call it after the batch's other reads, because it syncs.
 */
export async function loadSelectedRanges(
  context: Excel.RequestContext,
  properties: string
): Promise<Excel.RangeAreas | null> {
  const selection = context.workbook.getSelectedRanges().load(properties);
  try {
    await context.sync();
    return selection;
  } catch (error) {
    if (error instanceof OfficeExtension.Error && error.code === "InvalidSelection") {
      return null;
    }
    throw error;
  }
}

/** What Excel's error codes mean for the addresses and names the tools use. */
const excelHints: ErrorHints = {
  InvalidArgument:
    "check the address: A1 notation, sheet-qualified like Sheet1!A1:C10 or 'My Sheet'!A1 (no sheet means the " +
    "active sheet); get sheet names and used ranges with excel_get_overview",
  ItemNotFound:
    "a sheet, table, chart, pivot table, name or comment was not found; get current names with " +
    "excel_get_overview, and comment ids with excel_comments list",
  InvalidReference: "the reference is not valid for this operation; check the address with excel_get_overview",
  InsertDeleteConflict:
    "the insert or delete would split a table, merged cells, an array formula or a pivot table; choose other cells",
  InvalidOperation: "Excel does not allow this here, for example on a protected sheet or inside a table",
};

/** Runs an Excel batch unless the call was cancelled. Office errors are rethrown with Excel's debug info. */
export function runExcel<T>(signal: AbortSignal, batch: (context: Excel.RequestContext) => Promise<T>): Promise<T> {
  return runBatch(signal, () => Excel.run(batch), excelHints);
}

export const addressHint =
  "Addresses are A1 references, sheet-qualified like Sheet1!A1:C10 or 'My Sheet'!B2; without a sheet they are on " +
  "the active sheet. Sheet names and used ranges come from excel_get_overview.";

/** The most cells a read returns. Larger ranges are cut to their top rows and `truncated` is set. */
export const MAX_CELLS = 5000;

const SHEET_QUALIFIED = /^(?:'((?:[^']|'')+)'|([^'!]+))!(.+)$/;

/** Splits "Sheet1!A1:C10" or "'My Sheet'!A1" into the sheet name (null for none) and the cell reference. */
export function parseAddress(address: string): { sheet: string | null; cells: string } {
  const trimmed = address.trim();
  if (!trimmed.includes("!")) {
    return { sheet: null, cells: trimmed };
  }
  const match = SHEET_QUALIFIED.exec(trimmed);
  if (!match) {
    throw new ToolArgumentError(`"${address}" is not a valid address. ${addressHint}`);
  }
  return { sheet: match[1] !== undefined ? match[1].replace(/''/g, "'") : match[2], cells: match[3] };
}

/** The sheet with this name, or the active sheet when there is no name. */
export function getSheet(context: Excel.RequestContext, name?: string | null): Excel.Worksheet {
  return name ? context.workbook.worksheets.getItem(name) : context.workbook.worksheets.getActiveWorksheet();
}

/** The range at a sheet-qualified address, or on the active sheet. */
export function getRange(context: Excel.RequestContext, address: string): Excel.Range {
  const { sheet, cells } = parseAddress(address);
  return getSheet(context, sheet).getRange(cells);
}

/**
 * The part of a range a read may return: the whole range, or its top rows when it has more than `budget`
 * cells. The range's rowCount and columnCount must be loaded.
 */
export function capRange(range: Excel.Range, budget: number = MAX_CELLS): { range: Excel.Range; truncated: boolean } {
  if (range.rowCount * range.columnCount <= budget) {
    return { range, truncated: false };
  }
  const columns = Math.max(1, Math.min(range.columnCount, budget));
  const rows = Math.max(1, Math.floor(budget / columns));
  return { range: range.getAbsoluteResizedRange(rows, columns), truncated: true };
}

export type CellValue = string | number | boolean;

function isCellValue(value: unknown): value is CellValue {
  return (
    typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))
  );
}

/** A non-empty array of rows of strings, numbers or booleans. Shorter rows are padded with empty strings. */
export function requireCellMatrix(args: ToolArguments, name: string): CellValue[][] {
  const value = args[name];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((row) => !Array.isArray(row) || !row.every(isCellValue))
  ) {
    throw new ToolArgumentError(`"${name}" must be a non-empty array of rows of strings, numbers or booleans.`);
  }
  const rows = value as CellValue[][];
  const columns = Math.max(...rows.map((row) => row.length));
  if (columns === 0) {
    throw new ToolArgumentError(`"${name}" must have at least one cell.`);
  }
  return rows.map((row) => Array.from({ length: columns }, (_, index) => row[index] ?? ""));
}

/** JSON schema of a matrix read by requireCellMatrix. */
export const cellMatrixSchema = {
  type: "array",
  items: { type: "array", items: { type: ["string", "number", "boolean"] } },
};

/** A number format: one string for every cell, or rows of formats matching the range. */
export function readNumberFormat(args: ToolArguments, name: string): string | string[][] | undefined {
  const value = args[name];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((row) => Array.isArray(row) && row.length > 0 && row.every((cell) => typeof cell === "string"))
  ) {
    return value as string[][];
  }
  throw new ToolArgumentError(`"${name}" must be a string or a non-empty array of rows of strings.`);
}

export const numberFormatSchema = {
  anyOf: [{ type: "string" }, { type: "array", items: { type: "array", items: { type: "string" } } }],
  description: 'An Excel number format such as "0.00", "#,##0", "0%" or "yyyy-mm-dd", or rows of formats.',
};

/** Rows of number formats for a range of `rows` by `columns` cells. Rows of formats must have that size. */
export function numberFormatMatrix(format: string | string[][], rows: number, columns: number): string[][] {
  if (typeof format === "string") {
    return Array.from({ length: rows }, () => Array.from({ length: columns }, () => format));
  }
  if (format.length !== rows || format.some((row) => row.length !== columns)) {
    throw new ToolArgumentError(`The number format rows must be ${rows} by ${columns}, the size of the range.`);
  }
  return format;
}

/**
 * Column widths in Excel's own unit, characters of the workbook's default font: the unit Excel shows
 * the user and the model thinks in. Office.js reads and writes points. Excel makes a width of w
 * characters w * digitPixels + 5 pixels wide; digitPixels comes from the sheet's standard width
 * (characters) and the width in points of a column that has it: the sheet's last column, which is
 * almost never resized.
 */
export interface WidthScale {
  digitPixels: number;
}

const PADDING_PIXELS = 5;
const POINTS_PER_PIXEL = 0.75;
/** The digit width of Calibri and Aptos 11, the default fonts, when the sheet does not give one. */
const DEFAULT_DIGIT_PIXELS = 7;

export async function loadWidthScale(context: Excel.RequestContext, sheet: Excel.Worksheet): Promise<WidthScale> {
  sheet.load("standardWidth");
  const last = sheet.getRange("XFD:XFD").format.load("columnWidth");
  await context.sync();
  const digitPixels = (last.columnWidth / POINTS_PER_PIXEL - PADDING_PIXELS) / sheet.standardWidth;
  return { digitPixels: digitPixels > 3 && digitPixels < 30 ? digitPixels : DEFAULT_DIGIT_PIXELS };
}

export function charactersToPoints(characters: number, scale: WidthScale): number {
  return characters <= 0 ? 0 : (characters * scale.digitPixels + PADDING_PIXELS) * POINTS_PER_PIXEL;
}

export function pointsToCharacters(points: number, scale: WidthScale): number {
  const characters = (points / POINTS_PER_PIXEL - PADDING_PIXELS) / scale.digitPixels;
  return Math.max(0, Math.round(characters * 10) / 10);
}

export const widthHint =
  "Column widths are in characters, Excel's own unit (the default column is about 8.4); row heights are in " +
  "points (the default row is about 15).";
