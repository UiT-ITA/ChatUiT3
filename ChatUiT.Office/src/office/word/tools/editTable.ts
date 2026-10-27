/* global Word */

import {
  optionalInteger,
  optionalNumber,
  optionalOneOf,
  optionalString,
  requireNumberArray,
  requireObjectArray,
  requireOneOf,
  requireString,
  requireStringMatrix,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { describeError } from "../../../chat/conversation/conversation";
import { applyBanding, bandingProperties, loadTable, readBanding } from "./tableShared";
import { applyStyleName, runWord, styleNameHint } from "./shared";

const OPS = [
  "setValues",
  "insertRows",
  "insertColumns",
  "deleteRows",
  "deleteColumns",
  "mergeCells",
  "shading",
  "alignment",
  "borders",
  "columnWidths",
  "style",
  "deleteTable",
] as const;
const POSITIONS = ["before", "after"] as const;
const HORIZONTAL = ["Left", "Centered", "Right", "Justified"] as const;
const VERTICAL = ["Top", "Center", "Bottom"] as const;
const BORDER_LOCATIONS = [
  "Top",
  "Left",
  "Bottom",
  "Right",
  "InsideHorizontal",
  "InsideVertical",
  "Inside",
  "Outside",
  "All",
] as const;
type BorderSide = "top" | "bottom" | "left" | "right" | "insideHorizontal" | "insideVertical";
const OUTSIDE: BorderSide[] = ["top", "bottom", "left", "right"];
const INSIDE: BorderSide[] = ["insideHorizontal", "insideVertical"];
const BORDER_SIDES: Record<(typeof BORDER_LOCATIONS)[number], BorderSide[]> = {
  Top: ["top"],
  Left: ["left"],
  Bottom: ["bottom"],
  Right: ["right"],
  InsideHorizontal: ["insideHorizontal"],
  InsideVertical: ["insideVertical"],
  Inside: INSIDE,
  Outside: OUTSIDE,
  All: [...OUTSIDE, ...INSIDE],
};
const SIDE_LOCATIONS: Record<BorderSide, "Top" | "Bottom" | "Left" | "Right" | "InsideHorizontal" | "InsideVertical"> =
  {
    top: "Top",
    bottom: "Bottom",
    left: "Left",
    right: "Right",
    insideHorizontal: "InsideHorizontal",
    insideVertical: "InsideVertical",
  };
const BORDER_TYPES = ["None", "Single", "Double", "Dotted", "Dashed", "DotDashed", "Triple", "Wave"] as const;

export const editTable: OfficeToolDefinition = {
  name: "word_edit_table",
  description:
    "Edit the table that contains a paragraph with operations applied in order. Rows and columns are 0-based. " +
    "setValues: values from row, column (default 0, 0). insertRows/insertColumns: count (default 1) rows or " +
    "columns before or after row/column, optionally with values. deleteRows/deleteColumns: count from row/column. " +
    "mergeCells: the cells fromRow, fromColumn to toRow, toColumn. shading (color), alignment (horizontal, vertical) " +
    "and borders (location, type, color, width): on the cells fromRow, fromColumn to toRow, toColumn, or the whole " +
    "table when they are omitted. columnWidths: widths in points from the first column. style: style name, " +
    "headerRows and banding options. deleteTable. Indexes change after inserts, deletes and merges. " +
    `Table paragraph ids come from word_get_overview. ${styleNameHint}`,
  parameters: {
    type: "object",
    properties: {
      paragraphId: { type: "string", description: "Any paragraph in the table." },
      operations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            op: { type: "string", enum: [...OPS] },
            row: { type: "integer", minimum: 0 },
            column: { type: "integer", minimum: 0 },
            count: { type: "integer", minimum: 1 },
            position: { type: "string", enum: [...POSITIONS] },
            values: { type: "array", items: { type: "array", items: { type: "string" } } },
            fromRow: { type: "integer", minimum: 0 },
            fromColumn: { type: "integer", minimum: 0 },
            toRow: { type: "integer", minimum: 0 },
            toColumn: { type: "integer", minimum: 0 },
            color: { type: "string", description: "#RRGGBB or a color name." },
            horizontal: { type: "string", enum: [...HORIZONTAL] },
            vertical: { type: "string", enum: [...VERTICAL] },
            location: { type: "string", enum: [...BORDER_LOCATIONS] },
            type: { type: "string", enum: [...BORDER_TYPES] },
            width: { type: "number", exclusiveMinimum: 0, description: "Border width in points." },
            widths: { type: "array", items: { type: "number" } },
            name: { type: "string", description: "Table style name." },
            headerRows: { type: "integer", minimum: 0 },
            ...bandingProperties,
          },
          required: ["op"],
          additionalProperties: false,
        },
      },
    },
    required: ["paragraphId", "operations"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const paragraphId = requireString(args, "paragraphId");
    const operations = requireObjectArray(args, "operations");
    operations.forEach((operation, index) => {
      try {
        requireOneOf(operation, "op", OPS);
      } catch (error) {
        throw new ToolArgumentError(`Operation ${index + 1}: ${describeError(error)}`);
      }
    });

    return runWord(signal, async (context) => {
      const table = await loadTable(context, paragraphId);
      for (const [index, operation] of operations.entries()) {
        try {
          applyOperation(table, operation);
          // One sync per operation, so an error names the operation that failed.
          // eslint-disable-next-line office-addins/no-context-sync-in-loop
          await context.sync();
        } catch (error) {
          const done = index > 0 ? ` Operations 1 to ${index} were applied.` : "";
          throw new Error(`Operation ${index + 1} (${String(operation.op)}) failed: ${describeError(error)}${done}`, {
            cause: error,
          });
        }
      }
      return { appliedOperations: operations.length };
    });
  },
};

function applyOperation(table: Word.Table, operation: ToolArguments): void {
  const op = requireOneOf(operation, "op", OPS);
  switch (op) {
    case "setValues": {
      const values = requireStringMatrix(operation, "values");
      const row = optionalInteger(operation, "row") ?? 0;
      const column = optionalInteger(operation, "column") ?? 0;
      values.forEach((cells, r) =>
        cells.forEach((value, c) => {
          table.getCell(row + r, column + c).value = value;
        })
      );
      return;
    }
    case "insertRows": {
      const values = operation.values === undefined ? undefined : requireStringMatrix(operation, "values");
      const count = optionalInteger(operation, "count") ?? values?.length ?? 1;
      const cell = table.getCell(requireIndex(operation, "row"), 0);
      cell.parentRow.insertRows(position(operation), count, values);
      return;
    }
    case "insertColumns": {
      const values = operation.values === undefined ? undefined : requireStringMatrix(operation, "values");
      const count = optionalInteger(operation, "count") ?? 1;
      table.getCell(0, requireIndex(operation, "column")).insertColumns(position(operation), count, values);
      return;
    }
    case "deleteRows":
      table.deleteRows(requireIndex(operation, "row"), optionalInteger(operation, "count") ?? 1);
      return;
    case "deleteColumns":
      table.deleteColumns(requireIndex(operation, "column"), optionalInteger(operation, "count") ?? 1);
      return;
    case "mergeCells": {
      const cells = readCells(operation);
      if (!cells) {
        throw new ToolArgumentError(`"fromRow" and "fromColumn" are required for mergeCells.`);
      }
      table.mergeCells(cells.fromRow, cells.fromColumn, cells.toRow, cells.toColumn);
      return;
    }
    case "shading": {
      const color = requireString(operation, "color");
      const shade = (target: Word.Table | Word.TableCell) => {
        target.shadingColor = color;
      };
      forCells(table, operation, shade, () => shade(table));
      return;
    }
    case "alignment": {
      const horizontal = optionalOneOf(operation, "horizontal", HORIZONTAL);
      const vertical = optionalOneOf(operation, "vertical", VERTICAL);
      if (!horizontal && !vertical) {
        throw new ToolArgumentError(`Give "horizontal" or "vertical".`);
      }
      const align = (target: Word.Table | Word.TableCell) => {
        if (horizontal) {
          target.horizontalAlignment = horizontal;
        }
        if (vertical) {
          target.verticalAlignment = vertical;
        }
      };
      forCells(table, operation, align, () => align(table));
      return;
    }
    case "borders": {
      const location = requireOneOf(operation, "location", BORDER_LOCATIONS);
      const type = optionalOneOf(operation, "type", BORDER_TYPES);
      const color = optionalString(operation, "color");
      const width = optionalNumber(operation, "width");
      const set = (border: Word.TableBorder) => {
        if (type) {
          border.type = type;
        }
        if (color !== undefined) {
          border.color = color;
        }
        if (width !== undefined) {
          border.width = width;
        }
      };
      // Word rejects the combined locations (All, Outside, Inside) on some hosts, so every side is set on its own.
      const sides = BORDER_SIDES[location];
      const cells = readCells(operation);
      if (!cells) {
        sides.forEach((side) => set(table.getBorder(SIDE_LOCATIONS[side])));
        return;
      }
      for (let row = cells.fromRow; row <= cells.toRow; row++) {
        for (let column = cells.fromColumn; column <= cells.toColumn; column++) {
          const cell = table.getCell(row, column);
          const edges: Array<"Top" | "Bottom" | "Left" | "Right"> = [];
          if (
            (sides.includes("top") && row === cells.fromRow) ||
            (sides.includes("insideHorizontal") && row > cells.fromRow)
          ) {
            edges.push("Top");
          }
          if (
            (sides.includes("bottom") && row === cells.toRow) ||
            (sides.includes("insideHorizontal") && row < cells.toRow)
          ) {
            edges.push("Bottom");
          }
          if (
            (sides.includes("left") && column === cells.fromColumn) ||
            (sides.includes("insideVertical") && column > cells.fromColumn)
          ) {
            edges.push("Left");
          }
          if (
            (sides.includes("right") && column === cells.toColumn) ||
            (sides.includes("insideVertical") && column < cells.toColumn)
          ) {
            edges.push("Right");
          }
          edges.forEach((edge) => set(cell.getBorder(edge)));
        }
      }
      return;
    }
    case "columnWidths":
      requireNumberArray(operation, "widths").forEach((width, column) => {
        table.getCell(0, column).columnWidth = width;
      });
      return;
    case "style": {
      const name = optionalString(operation, "name");
      if (name) {
        applyStyleName(table, name);
      }
      const headerRows = optionalInteger(operation, "headerRows");
      if (headerRows !== undefined) {
        table.headerRowCount = headerRows;
      }
      applyBanding(table, readBanding(operation));
      return;
    }
    case "deleteTable":
      table.delete();
      return;
  }
}

function requireIndex(operation: ToolArguments, name: string): number {
  const value = optionalInteger(operation, name);
  if (value === undefined || value < 0) {
    throw new ToolArgumentError(`"${name}" must be an integer of at least 0.`);
  }
  return value;
}

function position(operation: ToolArguments): "Before" | "After" {
  return (optionalOneOf(operation, "position", POSITIONS) ?? "after") === "before" ? "Before" : "After";
}

interface Cells {
  fromRow: number;
  fromColumn: number;
  toRow: number;
  toColumn: number;
}

/** The cell rectangle of an operation, or undefined when it names no cells. */
function readCells(operation: ToolArguments): Cells | undefined {
  const fromRow = optionalInteger(operation, "fromRow");
  const fromColumn = optionalInteger(operation, "fromColumn");
  if (fromRow === undefined && fromColumn === undefined) {
    return undefined;
  }
  if (fromRow === undefined || fromColumn === undefined) {
    throw new ToolArgumentError(`Give both "fromRow" and "fromColumn".`);
  }
  return {
    fromRow,
    fromColumn,
    toRow: optionalInteger(operation, "toRow") ?? fromRow,
    toColumn: optionalInteger(operation, "toColumn") ?? fromColumn,
  };
}

function forCells(
  table: Word.Table,
  operation: ToolArguments,
  onCell: (cell: Word.TableCell) => void,
  onTable: () => void
): void {
  const cells = readCells(operation);
  if (!cells) {
    onTable();
    return;
  }
  for (let row = cells.fromRow; row <= cells.toRow; row++) {
    for (let column = cells.fromColumn; column <= cells.toColumn; column++) {
      onCell(table.getCell(row, column));
    }
  }
}
