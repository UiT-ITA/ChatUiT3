/* global Excel */

import {
  optionalInteger,
  optionalString,
  requireOneOf,
  requireString,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { runExcel } from "./shared";

const ACTIONS = [
  "add",
  "rename",
  "delete",
  "copy",
  "move",
  "activate",
  "hide",
  "show",
  "tab_color",
  "freeze",
  "unfreeze",
] as const;

export const sheets: OfficeToolDefinition = {
  name: "excel_sheets",
  description:
    "Manage worksheets. add: a new sheet name (optional position). rename: sheet to name. delete: sheet. copy: " +
    "sheet, optionally named name and placed at position (default right after it). move: sheet to position. " +
    "activate, hide, show: sheet. tab_color: sheet, color (#RRGGBB, a name, or none). freeze: keep the top rows " +
    "and left columns of sheet visible. unfreeze: sheet. Positions are 0-based. Sheet names come from " +
    "excel_get_overview. Returns the sheet's name and position.",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: [...ACTIONS] },
      sheet: { type: "string", description: "The sheet to act on; every action but add needs it." },
      name: { type: "string", description: "The new name, for add, rename and copy." },
      position: { type: "integer", minimum: 0 },
      color: { type: "string" },
      rows: { type: "integer", minimum: 0, description: "For freeze: how many top rows." },
      columns: { type: "integer", minimum: 0, description: "For freeze: how many left columns." },
    },
    required: ["action"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const action = requireOneOf(args, "action", ACTIONS);
    const position = optionalInteger(args, "position");
    if (position !== undefined && position < 0) {
      throw new ToolArgumentError(`"position" must be 0 or more.`);
    }
    if (action === "add") {
      const name = optionalString(args, "name");
      return runExcel(signal, async (context) => {
        const added = context.workbook.worksheets.add(name || undefined);
        if (position !== undefined) {
          added.position = position;
        }
        added.load("name,position");
        await context.sync();
        return { sheet: added.name, position: added.position };
      });
    }

    const sheetName = requireString(args, "sheet");
    const change = readChange(action, args, position);
    return runExcel(signal, async (context) => {
      const sheet = context.workbook.worksheets.getItem(sheetName);
      switch (change.action) {
        case "delete":
          sheet.delete();
          await context.sync();
          return { deleted: sheetName };
        case "copy": {
          const copy = sheet.copy("After", sheet);
          if (change.name) {
            copy.name = change.name;
          }
          if (change.position !== undefined) {
            copy.position = change.position;
          }
          copy.load("name,position");
          await context.sync();
          return { sheet: copy.name, position: copy.position };
        }
        case "rename":
          sheet.name = change.name;
          break;
        case "move":
          sheet.position = change.position;
          break;
        case "activate":
          sheet.activate();
          break;
        case "hide":
        case "show":
          sheet.visibility = change.action === "hide" ? "Hidden" : "Visible";
          break;
        case "tab_color":
          sheet.tabColor = change.color;
          break;
        case "freeze":
          freeze(sheet, change.rows, change.columns);
          break;
        case "unfreeze":
          sheet.freezePanes.unfreeze();
          break;
      }
      sheet.load("name,position,visibility");
      await context.sync();
      return { sheet: sheet.name, position: sheet.position, visibility: sheet.visibility };
    });
  },
};

type Change =
  | { action: "delete" | "activate" | "hide" | "show" | "unfreeze" }
  | { action: "copy"; name?: string; position?: number }
  | { action: "rename"; name: string }
  | { action: "move"; position: number }
  | { action: "tab_color"; color: string }
  | { action: "freeze"; rows: number; columns: number };

function readChange(action: Exclude<(typeof ACTIONS)[number], "add">, args: ToolArguments, position?: number): Change {
  switch (action) {
    case "copy":
      return { action, name: optionalString(args, "name") || undefined, position };
    case "rename":
      return { action, name: requireString(args, "name") };
    case "move":
      if (position === undefined) {
        throw new ToolArgumentError(`"position" is required for move.`);
      }
      return { action, position };
    case "tab_color": {
      const color = requireString(args, "color");
      return { action, color: color.toLowerCase() === "none" ? "" : color };
    }
    case "freeze": {
      const rows = optionalInteger(args, "rows") ?? 0;
      const columns = optionalInteger(args, "columns") ?? 0;
      if (rows < 0 || columns < 0 || rows + columns === 0) {
        throw new ToolArgumentError(`freeze needs "rows" or "columns" greater than 0.`);
      }
      return { action, rows, columns };
    }
    default:
      return { action };
  }
}

function freeze(sheet: Excel.Worksheet, rows: number, columns: number): void {
  const panes = sheet.freezePanes;
  if (rows > 0 && columns > 0) {
    panes.freezeAt(sheet.getRangeByIndexes(0, 0, rows, columns));
  } else if (rows > 0) {
    panes.freezeRows(rows);
  } else {
    panes.freezeColumns(columns);
  }
}
