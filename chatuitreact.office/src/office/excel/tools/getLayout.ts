/* global Excel, Office */

import { optionalString } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { getSheet, loadWidthScale, parseAddress, pointsToCharacters, runExcel, type WidthScale } from "./shared";

const MAX_COLUMNS = 60;
const MAX_ROWS = 400;
/** How far past the range the grid is measured, to place charts and shapes that lie beside it. */
const EXTRA_COLUMNS = 40;
const EXTRA_ROWS = 80;
const MAX_LISTED = 20;
/** The grid is never measured beyond these, however far an object lies. */
const MAX_GRID_COLUMNS = 400;
const MAX_GRID_ROWS = 2000;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const getLayout: OfficeToolDefinition = {
  name: "excel_get_layout",
  description:
    "Check how a range is laid out, as the user sees it. Per column: its width, the width its content needs " +
    "(measured with Excel's own autofit; the sheet is left as it was), whether the content fits, the longest " +
    "displayed text, and the cells that show #### because the column is too narrow. The rows whose content needs " +
    "more height than they have. Merged areas, frozen panes and whether gridlines show. Every chart and shape on " +
    "the sheet with the cells it starts and ends in and the filled cells it covers. Without address: the used " +
    "range of the active sheet. Use it before and after changing widths, heights or the placement of charts.",
  parameters: {
    type: "object",
    properties: {
      address: { type: "string", description: "Default: the used range of the active sheet." },
    },
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const address = optionalString(args, "address");
    return runExcel(signal, async (context) => {
      const parsed = address ? parseAddress(address) : null;
      const sheet = getSheet(context, parsed?.sheet);
      const area = parsed ? sheet.getRange(parsed.cells) : sheet.getUsedRangeOrNullObject(true);
      area.load("isNullObject,address,rowIndex,columnIndex,rowCount,columnCount");
      sheet.load("name,showGridlines");
      const frozen = sheet.freezePanes.getLocationOrNullObject().load("address");
      const charts = sheet.charts.load("items/name,items/left,items/top,items/width,items/height");
      const shapes = sheet.shapes.load("items/name,items/type,items/left,items/top,items/width,items/height");
      await context.sync();

      const objects: Array<Box & { kind: string; name: string }> = [
        ...charts.items.map((chart) => ({ kind: "chart", name: chart.name, ...boxOf(chart) })),
        ...shapes.items.map((shape) => ({ kind: shape.type, name: shape.name, ...boxOf(shape) })),
      ];
      const sheetInfo = {
        sheet: sheet.name,
        gridlines: sheet.showGridlines,
        frozenPanes: frozen.isNullObject ? null : frozen.address,
      };
      if (area.isNullObject) {
        return { ...sheetInfo, address: null, note: "The sheet has no content.", objects: objects.map(describeBox) };
      }

      const scale = await loadWidthScale(context, sheet);
      const columnCount = Math.min(area.columnCount, MAX_COLUMNS);
      const rowCount = Math.min(area.rowCount, MAX_ROWS);
      const core = area.getAbsoluteResizedRange(rowCount, columnCount).load("text,address");
      const columns = range(columnCount).map((index) => core.getColumn(index).format.load("columnWidth"));
      const rows = range(rowCount).map((index) => core.getRow(index).format.load("rowHeight"));
      const merged = Office.context.requirements.isSetSupported("ExcelApi", "1.13")
        ? core.getMergedAreasOrNullObject().load("address")
        : null;
      await context.sync();
      const widths = columns.map((format) => format.columnWidth);
      const heights = rows.map((format) => format.rowHeight);

      // Measured with Excel's own autofit, then every width and height autofit changed is put back.
      core.format.autofitColumns();
      core.format.autofitRows();
      const fitted = range(columnCount).map((index) => core.getColumn(index).format.load("columnWidth"));
      const fittedRows = range(rowCount).map((index) => core.getRow(index).format.load("rowHeight"));
      await context.sync();
      const needed = fitted.map((format) => format.columnWidth);
      const neededHeights = fittedRows.map((format) => format.rowHeight);
      needed.forEach((width, index) => {
        if (width !== widths[index]) {
          core.getColumn(index).format.columnWidth = widths[index];
        }
      });
      neededHeights.forEach((height, index) => {
        if (height !== heights[index]) {
          core.getRow(index).format.rowHeight = heights[index];
        }
      });
      await context.sync();

      const grid = await loadGrid(context, sheet, area.columnIndex + columnCount, area.rowIndex + rowCount, objects);
      const text = core.text;

      return {
        ...sheetInfo,
        address: core.address,
        ...(columnCount < area.columnCount || rowCount < area.rowCount
          ? { truncated: `Only the first ${rowCount} rows and ${columnCount} columns were checked.` }
          : {}),
        columns: range(columnCount).map((index) =>
          describeColumn(index, area, text, widths[index], needed[index], scale)
        ),
        rowsTooLow: range(rowCount).flatMap((index) =>
          neededHeights[index] > heights[index] + 0.5
            ? [{ row: area.rowIndex + index + 1, height: heights[index], needed: neededHeights[index] }]
            : []
        ),
        mergedAreas: merged && !merged.isNullObject ? merged.address.split(",") : [],
        objects: objects.map((object) => ({
          ...describeBox(object),
          ...placement(object, grid),
          ...coveredCells(object, grid, area, text),
        })),
      };
    });
  },
};

function range(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

function boxOf(item: Box): Box {
  return { left: item.left, top: item.top, width: item.width, height: item.height };
}

function describeBox(object: Box & { kind: string; name: string }) {
  return { kind: object.kind, name: object.name, widthPoints: round(object.width), heightPoints: round(object.height) };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function columnLetter(index: number): string {
  let letter = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter;
  }
  return letter;
}

function cellName(columnIndex: number, rowIndex: number): string {
  return `${columnLetter(columnIndex)}${rowIndex + 1}`;
}

function describeColumn(
  index: number,
  area: Excel.Range,
  text: string[][],
  width: number,
  needed: number,
  scale: WidthScale
) {
  let longest = { length: 0, cell: null as string | null };
  const cutOff: string[] = [];
  text.forEach((row, rowIndex) => {
    const value = row[index] ?? "";
    const cell = cellName(area.columnIndex + index, area.rowIndex + rowIndex);
    if (/^#+$/.test(value)) {
      cutOff.push(cell);
    } else if (value.length > longest.length) {
      longest = { length: value.length, cell };
    }
  });
  const widthCharacters = pointsToCharacters(width, scale);
  const neededCharacters = pointsToCharacters(needed, scale);
  return {
    column: columnLetter(area.columnIndex + index),
    width: widthCharacters,
    needed: neededCharacters,
    fits: neededCharacters <= widthCharacters + 0.2 && cutOff.length === 0,
    longestText: longest.cell ? longest : null,
    ...(cutOff.length > 0 ? { showsHashes: cutOff.slice(0, MAX_LISTED) } : {}),
  };
}

/** The left edge and width of each column, and the top edge and height of each row, from the top-left of the sheet. */
interface Grid {
  columns: Box[];
  rows: Box[];
}

/** Measures the grid far enough to the right and down to cover the range and every object. */
async function loadGrid(
  context: Excel.RequestContext,
  sheet: Excel.Worksheet,
  columnEnd: number,
  rowEnd: number,
  objects: Box[]
): Promise<Grid> {
  const columns = range(columnEnd + EXTRA_COLUMNS).map((index) =>
    sheet.getRangeByIndexes(0, index, 1, 1).load("left,width")
  );
  const rows = range(rowEnd + EXTRA_ROWS).map((index) => sheet.getRangeByIndexes(index, 0, 1, 1).load("top,height"));
  await context.sync();
  const grid = {
    columns: columns.map((cell) => ({ left: cell.left, width: cell.width, top: 0, height: 0 })),
    rows: rows.map((cell) => ({ left: 0, width: 0, top: cell.top, height: cell.height })),
  };
  const right = Math.max(0, ...objects.map((object) => object.left + object.width));
  const bottom = Math.max(0, ...objects.map((object) => object.top + object.height));
  const lastColumn = grid.columns[grid.columns.length - 1];
  const lastRow = grid.rows[grid.rows.length - 1];
  const outside = lastColumn.left + lastColumn.width < right || lastRow.top + lastRow.height < bottom;
  if (outside && columnEnd < MAX_GRID_COLUMNS && rowEnd < MAX_GRID_ROWS) {
    // An object lies beyond the measured grid: measure only what is needed to reach it.
    return loadGrid(context, sheet, columnEnd + EXTRA_COLUMNS * 2, rowEnd + EXTRA_ROWS * 2, objects);
  }
  return grid;
}

function columnAt(grid: Grid, x: number): number {
  const index = grid.columns.findIndex((column) => column.left + column.width > x);
  return index < 0 ? grid.columns.length - 1 : index;
}

function rowAt(grid: Grid, y: number): number {
  const index = grid.rows.findIndex((row) => row.top + row.height > y);
  return index < 0 ? grid.rows.length - 1 : index;
}

function placement(object: Box, grid: Grid) {
  return {
    from: cellName(columnAt(grid, object.left), rowAt(grid, object.top)),
    to: cellName(columnAt(grid, object.left + object.width - 0.1), rowAt(grid, object.top + object.height - 0.1)),
  };
}

/** The filled cells of the range that lie under the object. */
function coveredCells(object: Box, grid: Grid, area: Excel.Range, text: string[][]) {
  const firstColumn = columnAt(grid, object.left);
  const lastColumn = columnAt(grid, object.left + object.width - 0.1);
  const firstRow = rowAt(grid, object.top);
  const lastRow = rowAt(grid, object.top + object.height - 0.1);
  const cells: string[] = [];
  text.forEach((row, rowIndex) =>
    row.forEach((value, columnIndex) => {
      const column = area.columnIndex + columnIndex;
      const sheetRow = area.rowIndex + rowIndex;
      if (
        value !== "" &&
        column >= firstColumn &&
        column <= lastColumn &&
        sheetRow >= firstRow &&
        sheetRow <= lastRow
      ) {
        cells.push(cellName(column, sheetRow));
      }
    })
  );
  return {
    coversFilledCells: cells.length,
    ...(cells.length > 0 ? { filledCellsUnder: cells.slice(0, MAX_LISTED) } : {}),
  };
}
