/* global Excel */

import { joinContext, readWith } from "../shared/context";
import { getOverview } from "./tools/getOverview";
import { getSelection } from "./tools/getSelection";
import { readRange } from "./tools/readRange";

/** The most cells of the active sheet the context holds. Larger used ranges are cut to their top rows. */
const MAX_SHEET_CELLS = 2000;

/** What the user is looking at in Excel: the workbook overview, the selection and the active sheet's content. */
export function excelContext(): Promise<string> {
  return joinContext("Excel.", [
    ["Workbook overview", () => readWith(getOverview)],
    ["Selection", () => readWith(getSelection)],
    ["Active sheet", readActiveSheet],
  ]);
}

async function readActiveSheet(): Promise<unknown> {
  const area = await Excel.run(async (context) => {
    const used = context.workbook.worksheets.getActiveWorksheet().getUsedRangeOrNullObject(true);
    used.load("address,rowCount,columnCount");
    await context.sync();
    if (used.isNullObject) {
      return null;
    }
    const rows = Math.max(1, Math.min(used.rowCount, Math.floor(MAX_SHEET_CELLS / used.columnCount)));
    const read = used.getAbsoluteResizedRange(rows, Math.min(used.columnCount, MAX_SHEET_CELLS)).load("address");
    await context.sync();
    return { usedRange: used.address, read: read.address };
  });
  if (!area) {
    return { note: "The active sheet is empty." };
  }
  const content = (await readWith(readRange, { address: area.read })) as Record<string, unknown>;
  return area.read === area.usedRange
    ? content
    : { usedRange: area.usedRange, note: `Only ${area.read} is included here.`, ...content };
}
