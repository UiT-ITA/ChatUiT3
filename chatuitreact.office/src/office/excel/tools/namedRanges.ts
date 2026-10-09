import { optionalString, requireOneOf, requireString, ToolArgumentError } from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { getRange, runExcel } from "./shared";

const ACTIONS = ["list", "add", "delete"] as const;

export const namedRanges: OfficeToolDefinition = {
  name: "excel_named_ranges",
  description:
    "Workbook names. list: every name with its type, value, formula, comment and visibility. add: name for " +
    "address (a range) or formula (such as =0.25 or =Sheet1!$A$1*2), with an optional comment. delete: name. " +
    `Formulas can then use the name, such as =SUM(Sales).`,
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: [...ACTIONS] },
      name: { type: "string" },
      address: { type: "string" },
      formula: { type: "string" },
      comment: { type: "string" },
    },
    required: ["action"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const action = requireOneOf(args, "action", ACTIONS);
    switch (action) {
      case "list":
        return runExcel(signal, async (context) => {
          const names = context.workbook.names;
          names.load("items/name,items/type,items/value,items/formula,items/comment,items/visible");
          await context.sync();
          return {
            names: names.items.map((item) => ({
              name: item.name,
              type: item.type,
              value: item.value,
              formula: item.formula,
              comment: item.comment,
              visible: item.visible,
            })),
          };
        });
      case "add": {
        const name = requireString(args, "name");
        const target = readReference(args);
        const comment = optionalString(args, "comment");
        return runExcel(signal, async (context) => {
          const reference = "address" in target ? getRange(context, target.address) : target.formula;
          const added = context.workbook.names.add(name, reference, comment);
          added.load("name,value");
          await context.sync();
          return { name: added.name, value: added.value };
        });
      }
      case "delete": {
        const name = requireString(args, "name");
        return runExcel(signal, async (context) => {
          context.workbook.names.getItem(name).delete();
          await context.sync();
          return { deleted: name };
        });
      }
    }
  },
};

function readReference(args: ToolArguments): { address: string } | { formula: string } {
  const address = optionalString(args, "address");
  const formula = optionalString(args, "formula");
  if (address && !formula) {
    return { address };
  }
  if (formula && !address) {
    return { formula: formula.startsWith("=") ? formula : `=${formula}` };
  }
  throw new ToolArgumentError(`Give either "address" or "formula".`);
}
