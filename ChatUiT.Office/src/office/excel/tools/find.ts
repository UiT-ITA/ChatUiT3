import { optionalBoolean, optionalString, requireString } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { capRange, getSheet, MAX_CELLS, runExcel } from "./shared";

export const find: OfficeToolDefinition = {
  name: "excel_find",
  description:
    "Find cells whose value contains text, in one sheet or in every sheet of the workbook. Returns the matching " +
    `areas (sheet-qualified address and values), at most ${MAX_CELLS} cells; truncated is true when there are ` +
    "more. completeMatch matches the whole cell value only. Sheet names come from excel_get_overview.",
  parameters: {
    type: "object",
    properties: {
      text: { type: "string" },
      sheet: { type: "string", description: "Search only this sheet. Without it, every sheet is searched." },
      matchCase: { type: "boolean" },
      completeMatch: { type: "boolean" },
    },
    required: ["text"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const text = requireString(args, "text");
    const sheet = optionalString(args, "sheet");
    const criteria = {
      matchCase: optionalBoolean(args, "matchCase") ?? false,
      completeMatch: optionalBoolean(args, "completeMatch") ?? false,
    };

    return runExcel(signal, async (context) => {
      let sheets = [getSheet(context, sheet)];
      if (!sheet) {
        const all = context.workbook.worksheets;
        all.load("items");
        await context.sync();
        sheets = all.items;
      }
      const results = sheets.map((item) => item.findAllOrNullObject(text, criteria).load("address"));
      await context.sync();

      const areas = results
        .filter((result) => !result.isNullObject)
        .map((result) => result.areas.load("items/rowCount,items/columnCount"));
      await context.sync();

      let budget = MAX_CELLS;
      let truncated = false;
      const reads = areas.flatMap((collection) =>
        collection.items.flatMap((area) => {
          if (budget <= 0) {
            truncated = true;
            return [];
          }
          const capped = capRange(area, budget);
          truncated ||= capped.truncated;
          budget -= capped.truncated ? budget : area.rowCount * area.columnCount;
          return [capped.range.load("address,values")];
        })
      );
      await context.sync();

      return {
        matches: reads.map((range) => ({ address: range.address, values: range.values })),
        truncated,
      };
    });
  },
};
