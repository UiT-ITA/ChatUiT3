/* global Word */

import { optionalBoolean } from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";

/** Table style options shared by word_insert_table and word_edit_table. */

const BANDING = {
  bandedRows: "styleBandedRows",
  bandedColumns: "styleBandedColumns",
  firstColumn: "styleFirstColumn",
  lastColumn: "styleLastColumn",
  totalRow: "styleTotalRow",
} as const;

type BandingName = keyof typeof BANDING;

export const bandingProperties = {
  bandedRows: { type: "boolean" },
  bandedColumns: { type: "boolean" },
  firstColumn: { type: "boolean", description: "Special formatting of the first column." },
  lastColumn: { type: "boolean", description: "Special formatting of the last column." },
  totalRow: { type: "boolean", description: "Special formatting of the last row." },
};

export type Banding = Partial<Record<BandingName, boolean>>;

export function readBanding(args: ToolArguments): Banding {
  const banding: Banding = {};
  for (const name of Object.keys(BANDING) as BandingName[]) {
    const value = optionalBoolean(args, name);
    if (value !== undefined) {
      banding[name] = value;
    }
  }
  return banding;
}

export function applyBanding(table: Word.Table, banding: Banding): void {
  for (const [name, value] of Object.entries(banding)) {
    table[BANDING[name as BandingName]] = value;
  }
}

/** The table that contains the paragraph. */
export async function loadTable(context: Word.RequestContext, paragraphId: string): Promise<Word.Table> {
  const table = context.document.getParagraphByUniqueLocalId(paragraphId).parentTableOrNullObject;
  table.load("isNullObject");
  await context.sync();
  if (table.isNullObject) {
    throw new Error(`Paragraph "${paragraphId}" is not in a table.`);
  }
  return table;
}
