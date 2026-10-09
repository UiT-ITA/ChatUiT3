/* global Excel */

import {
  optionalBoolean,
  optionalOneOf,
  optionalString,
  optionalStringArray,
  requireOneOf,
  requireString,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { getRange, runExcel } from "./shared";

const ACTIONS = ["set", "clear"] as const;
const KINDS = ["list", "wholeNumber", "decimal", "date", "textLength"] as const;
const OPERATORS = [
  "Between",
  "NotBetween",
  "EqualTo",
  "NotEqualTo",
  "GreaterThan",
  "LessThan",
  "GreaterThanOrEqualTo",
  "LessThanOrEqualTo",
] as const;
const ERROR_STYLES = ["Stop", "Warning", "Information"] as const;

export const dataValidation: OfficeToolDefinition = {
  name: "excel_data_validation",
  description:
    "Data validation on a range. set replaces the range's validation with kind: list (source, a range such as " +
    "=Sheet2!$A$1:$A$5, or values; inCellDropDown default true), or wholeNumber, decimal, date or textLength with " +
    "operator, formula1 and, for Between and NotBetween, formula2 (values or formulas; dates as yyyy-mm-dd). " +
    "Optional inputTitle and inputMessage show when a cell is selected; errorStyle (default Stop), errorTitle and " +
    `errorMessage show for invalid input. clear: remove validation from the range.`,
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: [...ACTIONS] },
      address: { type: "string" },
      kind: { type: "string", enum: [...KINDS] },
      source: { type: "string" },
      values: { type: "array", items: { type: "string" }, description: "For list; values may not contain commas." },
      inCellDropDown: { type: "boolean" },
      operator: { type: "string", enum: [...OPERATORS] },
      formula1: { type: ["string", "number"] },
      formula2: { type: ["string", "number"] },
      inputTitle: { type: "string" },
      inputMessage: { type: "string" },
      errorStyle: { type: "string", enum: [...ERROR_STYLES] },
      errorTitle: { type: "string" },
      errorMessage: { type: "string" },
    },
    required: ["action", "address"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const action = requireOneOf(args, "action", ACTIONS);
    const address = requireString(args, "address");
    if (action === "clear") {
      return runExcel(signal, async (context) => {
        const range = getRange(context, address).load("address");
        range.dataValidation.clear();
        await context.sync();
        return { cleared: range.address };
      });
    }

    const kind = requireOneOf(args, "kind", KINDS);
    const rule = readRule(kind, args);
    const inputTitle = optionalString(args, "inputTitle");
    const inputMessage = optionalString(args, "inputMessage");
    const errorStyle = optionalOneOf(args, "errorStyle", ERROR_STYLES);
    const errorTitle = optionalString(args, "errorTitle");
    const errorMessage = optionalString(args, "errorMessage");
    return runExcel(signal, async (context) => {
      const range = getRange(context, address).load("address");
      const validation = range.dataValidation;
      // Clear first so the new rule replaces any rule the cells have.
      validation.clear();
      validation.rule = rule;
      if (inputTitle || inputMessage) {
        validation.prompt = { showPrompt: true, title: inputTitle ?? "", message: inputMessage ?? "" };
      }
      if (errorStyle || errorTitle || errorMessage) {
        validation.errorAlert = {
          showAlert: true,
          style: errorStyle ?? "Stop",
          title: errorTitle ?? "",
          message: errorMessage ?? "",
        };
      }
      await context.sync();
      return { address: range.address, kind };
    });
  },
};

function readFormula(args: ToolArguments, name: string): string | number | undefined {
  const value = args[name];
  if (value === undefined || value === null) {
    return undefined;
  }
  if ((typeof value === "string" && value) || (typeof value === "number" && Number.isFinite(value))) {
    return value;
  }
  throw new ToolArgumentError(`"${name}" must be a number or a non-empty string.`);
}

function readRule(kind: (typeof KINDS)[number], args: ToolArguments): Excel.DataValidationRule {
  if (kind === "list") {
    return { list: { source: readListSource(args), inCellDropDown: optionalBoolean(args, "inCellDropDown") ?? true } };
  }
  const operator = requireOneOf(args, "operator", OPERATORS);
  const formula1 = readFormula(args, "formula1");
  const formula2 = readFormula(args, "formula2");
  if (formula1 === undefined) {
    throw new ToolArgumentError(`"formula1" is required for ${kind}.`);
  }
  if ((operator === "Between" || operator === "NotBetween") && formula2 === undefined) {
    throw new ToolArgumentError(`"formula2" is required for ${operator}.`);
  }
  const bounds = { operator, formula1, ...(formula2 !== undefined ? { formula2 } : {}) };
  switch (kind) {
    case "wholeNumber":
      return { wholeNumber: bounds };
    case "decimal":
      return { decimal: bounds };
    case "textLength":
      return { textLength: bounds };
    case "date":
      return {
        date: {
          operator,
          formula1: String(formula1),
          ...(formula2 !== undefined ? { formula2: String(formula2) } : {}),
        },
      };
  }
}

function readListSource(args: ToolArguments): string {
  const source = optionalString(args, "source");
  const values = optionalStringArray(args, "values");
  if (source && values === undefined) {
    return source;
  }
  if (values !== undefined && !source) {
    if (values.length === 0 || values.some((value) => value.includes(","))) {
      throw new ToolArgumentError(`"values" must be a non-empty array of values without commas.`);
    }
    return values.join(",");
  }
  throw new ToolArgumentError(`A list needs either "source" or "values".`);
}
