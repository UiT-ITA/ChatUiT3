import { requireOneOf, requireString } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { getRange, runExcel } from "./shared";

const WHAT = ["contents", "formats", "all"] as const;
const APPLY_TO = { contents: "Contents", formats: "Formats", all: "All" } as const;

export const clearRange: OfficeToolDefinition = {
  name: "excel_clear_range",
  description:
    "Clear a range without deleting its cells: contents (values and formulas), formats, or all. To remove cells " +
    `and shift the rest, use excel_insert_delete.`,
  parameters: {
    type: "object",
    properties: {
      address: { type: "string" },
      what: { type: "string", enum: [...WHAT] },
    },
    required: ["address", "what"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const address = requireString(args, "address");
    const what = requireOneOf(args, "what", WHAT);
    return runExcel(signal, async (context) => {
      const range = getRange(context, address);
      range.clear(APPLY_TO[what]);
      range.load("address");
      await context.sync();
      return { cleared: range.address, what };
    });
  },
};
