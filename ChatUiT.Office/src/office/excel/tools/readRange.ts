/* global Excel */

import { optionalBoolean, requireString } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { capRange, getRange, MAX_CELLS, runExcel } from "./shared";

export const readRange: OfficeToolDefinition = {
  name: "excel_read_range",
  description:
    "Read a range: its values, formulas and number formats, row by row. With includeFormatting, also the range's " +
    "font (name, size, bold, italic, color), fill color, alignment and wrap text; each is null when the cells " +
    `differ. At most ${MAX_CELLS} cells are returned: a larger range is cut to its top rows, readAddress says ` +
    `which cells were read and truncated is true.`,
  parameters: {
    type: "object",
    properties: {
      address: { type: "string", description: "The range, such as Sheet1!A1:D20." },
      includeFormatting: { type: "boolean" },
    },
    required: ["address"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const address = requireString(args, "address");
    const includeFormatting = optionalBoolean(args, "includeFormatting") ?? false;
    return runExcel(signal, async (context) => {
      const range = getRange(context, address).load("address,rowCount,columnCount");
      await context.sync();

      const { range: read, truncated } = capRange(range);
      read.load("address,values,formulas,numberFormat");
      if (includeFormatting) {
        read.format.load("horizontalAlignment,verticalAlignment,wrapText");
        read.format.font.load("name,size,bold,italic,color");
        read.format.fill.load("color");
      }
      await context.sync();

      return {
        address: range.address,
        readAddress: read.address,
        rows: range.rowCount,
        columns: range.columnCount,
        values: read.values,
        formulas: read.formulas,
        numberFormat: read.numberFormat,
        ...(includeFormatting ? { formatting: formattingOf(read.format) } : {}),
        truncated,
      };
    });
  },
};

/** The format of a range. Excel reports a property that differs between cells as null. */
function formattingOf(format: Excel.RangeFormat) {
  const { font, fill } = format;
  return {
    font: {
      name: font.name ?? null,
      size: font.size ?? null,
      bold: font.bold ?? null,
      italic: font.italic ?? null,
      color: font.color ?? null,
    },
    fillColor: fill.color ?? null,
    horizontalAlignment: format.horizontalAlignment ?? null,
    verticalAlignment: format.verticalAlignment ?? null,
    wrapText: format.wrapText ?? null,
  };
}
