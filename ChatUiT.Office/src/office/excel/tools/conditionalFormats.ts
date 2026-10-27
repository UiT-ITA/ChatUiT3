/* global Excel */

import {
  optionalBoolean,
  optionalInteger,
  optionalObject,
  optionalOneOf,
  optionalString,
  requireOneOf,
  requireString,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { getRange, runExcel } from "./shared";

const ACTIONS = ["add", "list", "clear"] as const;
const TYPES = ["colorScale", "dataBar", "iconSet", "cellValue", "containsText", "topBottom"] as const;
/** The Excel.ConditionalFormatType of each type. */
const EXCEL_TYPES = {
  colorScale: "ColorScale",
  dataBar: "DataBar",
  iconSet: "IconSet",
  cellValue: "CellValue",
  containsText: "ContainsText",
  topBottom: "TopBottom",
} as const satisfies Record<(typeof TYPES)[number], string>;
const CELL_OPERATORS = [
  "Between",
  "NotBetween",
  "EqualTo",
  "NotEqualTo",
  "GreaterThan",
  "LessThan",
  "GreaterThanOrEqual",
  "LessThanOrEqual",
] as const;
const TEXT_OPERATORS = ["Contains", "NotContains", "BeginsWith", "EndsWith"] as const;
const RANK_TYPES = ["TopItems", "TopPercent", "BottomItems", "BottomPercent"] as const;
const ICON_SETS = [
  "ThreeArrows",
  "ThreeArrowsGray",
  "ThreeFlags",
  "ThreeTrafficLights1",
  "ThreeTrafficLights2",
  "ThreeSigns",
  "ThreeSymbols",
  "ThreeSymbols2",
  "ThreeStars",
  "ThreeTriangles",
  "FourArrows",
  "FourArrowsGray",
  "FourRedToBlack",
  "FourRating",
  "FourTrafficLights",
  "FiveArrows",
  "FiveArrowsGray",
  "FiveRating",
  "FiveQuarters",
  "FiveBoxes",
] as const;

interface CellFormat {
  fontColor?: string;
  fillColor?: string;
  bold?: boolean;
  italic?: boolean;
}

type Rule =
  | { type: "colorScale"; minColor: string; midColor?: string; maxColor: string }
  | { type: "dataBar"; barColor?: string }
  | { type: "iconSet"; iconSet: (typeof ICON_SETS)[number] }
  | {
      type: "cellValue";
      operator: (typeof CELL_OPERATORS)[number];
      formula1: string;
      formula2?: string;
      format: CellFormat;
    }
  | { type: "containsText"; operator: (typeof TEXT_OPERATORS)[number]; text: string; format: CellFormat }
  | { type: "topBottom"; rankType: (typeof RANK_TYPES)[number]; rank: number; format: CellFormat };

export const conditionalFormats: OfficeToolDefinition = {
  name: "excel_conditional_formats",
  description:
    "Conditional formats on a range. add a type: colorScale (minColor, optional midColor, maxColor), dataBar " +
    "(optional barColor), iconSet (iconSet), cellValue (operator, formula1, formula2 for Between and NotBetween, " +
    "format), containsText (text, textOperator default Contains, format), topBottom (rank, rankType default " +
    "TopItems, format). Formulas are values or formulas such as 100 or =$B$1. format sets fontColor, fillColor, " +
    "bold and italic of matching cells. list: the conditional formats touching address (type, priority, " +
    `addresses). clear: remove every conditional format from address.`,
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: [...ACTIONS] },
      address: { type: "string" },
      type: { type: "string", enum: [...TYPES], description: "For add." },
      minColor: { type: "string" },
      midColor: { type: "string" },
      maxColor: { type: "string" },
      barColor: { type: "string" },
      iconSet: { type: "string", enum: [...ICON_SETS] },
      operator: { type: "string", enum: [...CELL_OPERATORS] },
      formula1: { type: ["string", "number"] },
      formula2: { type: ["string", "number"] },
      text: { type: "string" },
      textOperator: { type: "string", enum: [...TEXT_OPERATORS] },
      rank: { type: "integer", minimum: 1 },
      rankType: { type: "string", enum: [...RANK_TYPES] },
      format: {
        type: "object",
        properties: {
          fontColor: { type: "string" },
          fillColor: { type: "string" },
          bold: { type: "boolean" },
          italic: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
    required: ["action", "address"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const action = requireOneOf(args, "action", ACTIONS);
    const address = requireString(args, "address");
    switch (action) {
      case "add": {
        const rule = readRule(args);
        return runExcel(signal, async (context) => {
          const range = getRange(context, address).load("address");
          await refusePivotCells(context, range);
          const added = range.conditionalFormats.add(EXCEL_TYPES[rule.type]);
          applyRule(added, rule);
          added.load("priority");
          await context.sync();
          return { address: range.address, type: rule.type, priority: added.priority };
        });
      }
      case "list":
        return runExcel(signal, async (context) => {
          const formats = getRange(context, address).conditionalFormats;
          formats.load("items/type,items/priority,items/stopIfTrue");
          await context.sync();
          const ranges = formats.items.map((format) => format.getRanges().load("address"));
          await context.sync();
          return {
            conditionalFormats: formats.items.map((format, index) => ({
              type: format.type,
              priority: format.priority,
              stopIfTrue: format.stopIfTrue,
              address: ranges[index].address,
            })),
          };
        });
      case "clear":
        return runExcel(signal, async (context) => {
          const range = getRange(context, address).load("address");
          range.conditionalFormats.clearAll();
          await context.sync();
          return { cleared: range.address };
        });
    }
  },
};

/**
 * Excel rejects a conditional format that an add-in adds to pivot table cells, with ItemNotFound
 * from ConditionalFormat._OnAccess. Said up front, with the pivot table's name, instead.
 */
async function refusePivotCells(context: Excel.RequestContext, range: Excel.Range): Promise<void> {
  const pivots = range.worksheet.pivotTables.load("items/name");
  await context.sync();
  const overlaps = pivots.items.map((pivot) => ({
    name: pivot.name,
    overlap: pivot.layout.getRange().getIntersectionOrNullObject(range).load("address"),
  }));
  await context.sync();
  const hit = overlaps.find((item) => !item.overlap.isNullObject);
  if (hit) {
    throw new Error(
      `${hit.overlap.address} is part of the pivot table "${hit.name}". Excel does not let the add-in add ` +
        "conditional formats to pivot table cells. Tell the user, or format a copy of the values outside the pivot table."
    );
  }
}

function readFormula(args: ToolArguments, name: string): string | undefined {
  const value = args[name];
  if (value === undefined || value === null) {
    return undefined;
  }
  if ((typeof value === "string" && value) || (typeof value === "number" && Number.isFinite(value))) {
    return String(value);
  }
  throw new ToolArgumentError(`"${name}" must be a number or a non-empty string.`);
}

function readFormat(args: ToolArguments): CellFormat {
  const format = optionalObject(args, "format");
  const result: CellFormat = format
    ? {
        fontColor: optionalString(format, "fontColor"),
        fillColor: optionalString(format, "fillColor"),
        bold: optionalBoolean(format, "bold"),
        italic: optionalBoolean(format, "italic"),
      }
    : {};
  if (Object.values(result).every((value) => value === undefined)) {
    throw new ToolArgumentError(`"format" needs fontColor, fillColor, bold or italic.`);
  }
  return result;
}

function readRule(args: ToolArguments): Rule {
  const type = requireOneOf(args, "type", TYPES);
  switch (type) {
    case "colorScale":
      return {
        type,
        minColor: requireString(args, "minColor"),
        midColor: optionalString(args, "midColor") || undefined,
        maxColor: requireString(args, "maxColor"),
      };
    case "dataBar":
      return { type, barColor: optionalString(args, "barColor") || undefined };
    case "iconSet":
      return { type, iconSet: requireOneOf(args, "iconSet", ICON_SETS) };
    case "cellValue": {
      const operator = requireOneOf(args, "operator", CELL_OPERATORS);
      const formula1 = readFormula(args, "formula1");
      const formula2 = readFormula(args, "formula2");
      if (formula1 === undefined) {
        throw new ToolArgumentError(`"formula1" is required for cellValue.`);
      }
      if ((operator === "Between" || operator === "NotBetween") && formula2 === undefined) {
        throw new ToolArgumentError(`"formula2" is required for ${operator}.`);
      }
      return { type, operator, formula1, formula2, format: readFormat(args) };
    }
    case "containsText":
      return {
        type,
        operator: optionalOneOf(args, "textOperator", TEXT_OPERATORS) ?? "Contains",
        text: requireString(args, "text"),
        format: readFormat(args),
      };
    case "topBottom": {
      const rank = optionalInteger(args, "rank");
      if (rank === undefined || rank < 1) {
        throw new ToolArgumentError(`"rank" must be an integer of 1 or more.`);
      }
      return {
        type,
        rankType: optionalOneOf(args, "rankType", RANK_TYPES) ?? "TopItems",
        rank,
        format: readFormat(args),
      };
    }
  }
}

function applyFormat(target: Excel.ConditionalRangeFormat, format: CellFormat): void {
  if (format.fontColor !== undefined) {
    target.font.color = format.fontColor;
  }
  if (format.fillColor !== undefined) {
    target.fill.color = format.fillColor;
  }
  if (format.bold !== undefined) {
    target.font.bold = format.bold;
  }
  if (format.italic !== undefined) {
    target.font.italic = format.italic;
  }
}

function applyRule(format: Excel.ConditionalFormat, rule: Rule): void {
  switch (rule.type) {
    case "colorScale":
      format.colorScale.criteria = {
        minimum: { type: "LowestValue", color: rule.minColor },
        ...(rule.midColor ? { midpoint: { type: "Percentile", formula: "50", color: rule.midColor } } : {}),
        maximum: { type: "HighestValue", color: rule.maxColor },
      };
      break;
    case "dataBar":
      if (rule.barColor) {
        format.dataBar.positiveFormat.fillColor = rule.barColor;
      }
      break;
    case "iconSet":
      format.iconSet.style = rule.iconSet;
      break;
    case "cellValue":
      format.cellValue.rule = {
        operator: rule.operator,
        formula1: rule.formula1,
        ...(rule.formula2 !== undefined ? { formula2: rule.formula2 } : {}),
      };
      applyFormat(format.cellValue.format, rule.format);
      break;
    case "containsText":
      format.textComparison.rule = { operator: rule.operator, text: rule.text };
      applyFormat(format.textComparison.format, rule.format);
      break;
    case "topBottom":
      format.topBottom.rule = { type: rule.rankType, rank: rule.rank };
      applyFormat(format.topBottom.format, rule.format);
      break;
  }
}
