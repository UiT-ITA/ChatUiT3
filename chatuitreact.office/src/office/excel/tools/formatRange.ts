/* global Excel */

import {
  optionalBoolean,
  optionalObject,
  optionalOneOf,
  optionalPositiveNumber,
  optionalString,
  requireString,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import {
  charactersToPoints,
  getRange,
  loadWidthScale,
  numberFormatMatrix,
  numberFormatSchema,
  readNumberFormat,
  runExcel,
  widthHint,
} from "./shared";

const UNDERLINES = ["None", "Single", "Double", "SingleAccountant", "DoubleAccountant"] as const;
const HORIZONTAL = [
  "General",
  "Left",
  "Center",
  "Right",
  "Fill",
  "Justify",
  "CenterAcrossSelection",
  "Distributed",
] as const;
const VERTICAL = ["Top", "Center", "Bottom", "Justify", "Distributed"] as const;
const BORDER_STYLES = ["None", "Continuous", "Dash", "DashDot", "DashDotDot", "Dot", "Double", "SlantDashDot"] as const;
const BORDER_WEIGHTS = ["Hairline", "Thin", "Medium", "Thick"] as const;
const EDGES = ["EdgeTop", "EdgeBottom", "EdgeLeft", "EdgeRight"] as const;
const INSIDE = ["InsideVertical", "InsideHorizontal"] as const;
const BORDER_SIDES = [...EDGES, ...INSIDE, "DiagonalDown", "DiagonalUp", "Outline", "Inside", "All"] as const;
const MERGES = ["merge", "mergeAcross", "unmerge"] as const;

type BorderIndex = (typeof EDGES)[number] | (typeof INSIDE)[number] | "DiagonalDown" | "DiagonalUp";

interface Font {
  name?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: (typeof UNDERLINES)[number];
  color?: string;
}

interface Borders {
  sides: BorderIndex[];
  style: (typeof BORDER_STYLES)[number];
  color?: string;
  weight?: (typeof BORDER_WEIGHTS)[number];
}

export const formatRange: OfficeToolDefinition = {
  name: "excel_format_range",
  description:
    "Format a range. Only the given properties change: font, fill color, alignment, wrap text, number format, " +
    "borders, column width, row height, autofit of columns and rows, and merge or unmerge " +
    `(mergeAcross merges each row separately). Colors are #RRGGBB or names such as red. ${widthHint} ` +
    "To make columns wide enough for their content, take the needed widths from excel_get_layout.",
  parameters: {
    type: "object",
    properties: {
      address: { type: "string" },
      font: {
        type: "object",
        properties: {
          name: { type: "string" },
          size: { type: "number", exclusiveMinimum: 0 },
          bold: { type: "boolean" },
          italic: { type: "boolean" },
          underline: { type: "string", enum: [...UNDERLINES] },
          color: { type: "string" },
        },
        additionalProperties: false,
      },
      fillColor: { type: "string", description: 'A color, or "none" to remove the fill.' },
      horizontalAlignment: { type: "string", enum: [...HORIZONTAL] },
      verticalAlignment: { type: "string", enum: [...VERTICAL] },
      wrapText: { type: "boolean" },
      numberFormat: numberFormatSchema,
      borders: {
        type: "object",
        properties: {
          sides: {
            type: "array",
            items: { type: "string", enum: [...BORDER_SIDES] },
            description: "Outline is the four edges, Inside is both inside borders, All is both.",
          },
          style: {
            type: "string",
            enum: [...BORDER_STYLES],
            description: "Default Continuous. None removes the borders.",
          },
          color: { type: "string" },
          weight: { type: "string", enum: [...BORDER_WEIGHTS] },
        },
        required: ["sides"],
        additionalProperties: false,
      },
      columnWidth: { type: "number", exclusiveMinimum: 0, description: "In characters, as Excel shows it." },
      rowHeight: { type: "number", exclusiveMinimum: 0, description: "In points." },
      autofitColumns: { type: "boolean" },
      autofitRows: { type: "boolean" },
      merge: { type: "string", enum: [...MERGES] },
    },
    required: ["address"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const address = requireString(args, "address");
    const font = readFont(optionalObject(args, "font"));
    const fillColor = optionalString(args, "fillColor");
    const horizontalAlignment = optionalOneOf(args, "horizontalAlignment", HORIZONTAL);
    const verticalAlignment = optionalOneOf(args, "verticalAlignment", VERTICAL);
    const wrapText = optionalBoolean(args, "wrapText");
    const numberFormat = readNumberFormat(args, "numberFormat");
    const borders = readBorders(optionalObject(args, "borders"));
    const columnWidth = optionalPositiveNumber(args, "columnWidth");
    const rowHeight = optionalPositiveNumber(args, "rowHeight");
    const autofitColumns = optionalBoolean(args, "autofitColumns") ?? false;
    const autofitRows = optionalBoolean(args, "autofitRows") ?? false;
    const merge = optionalOneOf(args, "merge", MERGES);
    const changes = [
      font,
      fillColor,
      horizontalAlignment,
      verticalAlignment,
      wrapText,
      numberFormat,
      borders,
      columnWidth,
      rowHeight,
      merge,
    ];
    if (changes.every((change) => change === undefined) && !autofitColumns && !autofitRows) {
      throw new ToolArgumentError("Give at least one formatting property.");
    }

    return runExcel(signal, async (context) => {
      const range = getRange(context, address);
      if (numberFormat !== undefined) {
        range.load("rowCount,columnCount");
        await context.sync();
        range.numberFormat = numberFormatMatrix(numberFormat, range.rowCount, range.columnCount);
      }
      if (merge === "unmerge") {
        range.unmerge();
      } else if (merge) {
        range.merge(merge === "mergeAcross");
      }
      const format = range.format;
      if (font) {
        applyFont(format.font, font);
      }
      if (fillColor !== undefined) {
        if (fillColor.toLowerCase() === "none") {
          format.fill.clear();
        } else {
          format.fill.color = fillColor;
        }
      }
      if (horizontalAlignment) {
        format.horizontalAlignment = horizontalAlignment;
      }
      if (verticalAlignment) {
        format.verticalAlignment = verticalAlignment;
      }
      if (wrapText !== undefined) {
        format.wrapText = wrapText;
      }
      if (borders) {
        applyBorders(format.borders, borders);
      }
      if (columnWidth !== undefined) {
        format.columnWidth = charactersToPoints(columnWidth, await loadWidthScale(context, range.worksheet));
      }
      if (rowHeight !== undefined) {
        format.rowHeight = rowHeight;
      }
      if (autofitColumns) {
        format.autofitColumns();
      }
      if (autofitRows) {
        format.autofitRows();
      }
      range.load("address");
      await context.sync();
      return { address: range.address };
    });
  },
};

function readFont(args: ToolArguments | undefined): Font | undefined {
  if (!args) {
    return undefined;
  }
  const font: Font = {
    name: optionalString(args, "name"),
    size: optionalPositiveNumber(args, "size"),
    bold: optionalBoolean(args, "bold"),
    italic: optionalBoolean(args, "italic"),
    underline: optionalOneOf(args, "underline", UNDERLINES),
    color: optionalString(args, "color"),
  };
  if (Object.values(font).every((value) => value === undefined)) {
    throw new ToolArgumentError(`"font" must have at least one property.`);
  }
  return font;
}

function applyFont(target: Excel.RangeFont, font: Font): void {
  if (font.name !== undefined) {
    target.name = font.name;
  }
  if (font.size !== undefined) {
    target.size = font.size;
  }
  if (font.bold !== undefined) {
    target.bold = font.bold;
  }
  if (font.italic !== undefined) {
    target.italic = font.italic;
  }
  if (font.underline !== undefined) {
    target.underline = font.underline;
  }
  if (font.color !== undefined) {
    target.color = font.color;
  }
}

function readBorders(args: ToolArguments | undefined): Borders | undefined {
  if (!args) {
    return undefined;
  }
  const value = args.sides;
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((side) => !(BORDER_SIDES as readonly unknown[]).includes(side))
  ) {
    throw new ToolArgumentError(`"borders.sides" must be a non-empty array of: ${BORDER_SIDES.join(", ")}.`);
  }
  const sides = new Set<BorderIndex>();
  for (const side of value as (typeof BORDER_SIDES)[number][]) {
    const expanded: readonly BorderIndex[] =
      side === "Outline" ? EDGES : side === "Inside" ? INSIDE : side === "All" ? [...EDGES, ...INSIDE] : [side];
    expanded.forEach((index) => sides.add(index));
  }
  // Color and weight alone draw nothing on a cell without a border, so the style defaults to Continuous.
  return {
    sides: [...sides],
    style: optionalOneOf(args, "style", BORDER_STYLES) ?? "Continuous",
    color: optionalString(args, "color"),
    weight: optionalOneOf(args, "weight", BORDER_WEIGHTS),
  };
}

function applyBorders(collection: Excel.RangeBorderCollection, borders: Borders): void {
  for (const side of borders.sides) {
    const border = collection.getItem(side);
    border.style = borders.style;
    if (borders.style === "None") {
      continue;
    }
    if (borders.color !== undefined) {
      border.color = borders.color;
    }
    if (borders.weight !== undefined) {
      border.weight = borders.weight;
    }
  }
}
