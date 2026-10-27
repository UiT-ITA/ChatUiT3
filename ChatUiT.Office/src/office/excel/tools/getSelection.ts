import type { OfficeToolDefinition } from "../../shared/officeTool";
import { capRange, loadSelectedRanges, MAX_CELLS, NOT_CELLS, runExcel } from "./shared";

export const getSelection: OfficeToolDefinition = {
  name: "excel_get_selection",
  description:
    "Get the cells the user has selected: the sheet-qualified address, and per selected area its values, formulas " +
    `and number formats. At most ${MAX_CELLS} cells are returned; truncated is true when the selection is larger ` +
    "(read the rest with excel_read_range). When a chart, shape or other object is selected instead of cells, " +
    "address is null and note says so.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  handler: (_args, signal) =>
    runExcel(signal, async (context) => {
      const selection = await loadSelectedRanges(context, "address");
      if (!selection) {
        return { address: null, note: NOT_CELLS };
      }
      const areas = selection.areas;
      areas.load("items/address,items/rowCount,items/columnCount");
      await context.sync();

      let budget = MAX_CELLS;
      let truncated = false;
      const reads = areas.items.flatMap((area) => {
        if (budget <= 0) {
          truncated = true;
          return [];
        }
        const capped = capRange(area, budget);
        truncated ||= capped.truncated;
        budget -= capped.truncated ? budget : area.rowCount * area.columnCount;
        return [{ area, range: capped.range.load("address,values,formulas,numberFormat") }];
      });
      await context.sync();

      return {
        address: selection.address,
        areas: reads.map(({ area, range }) => ({
          address: area.address,
          ...(range.address !== area.address ? { readAddress: range.address } : {}),
          values: range.values,
          formulas: range.formulas,
          numberFormat: range.numberFormat,
        })),
        truncated,
      };
    }),
};
