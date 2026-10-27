import { requireString } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import {
  cellMatrixSchema,
  getRange,
  numberFormatMatrix,
  numberFormatSchema,
  readNumberFormat,
  requireCellMatrix,
  runExcel,
} from "./shared";

export const writeRange: OfficeToolDefinition = {
  name: "excel_write_range",
  description:
    "Write rows of values to cells. Strings starting with = are formulas, such as =SUM(B2:B10). address is the " +
    "top-left cell, or the whole range with exactly the size of the data. Shorter rows are padded with empty " +
    `cells. Optionally sets the number format. Returns the address written.`,
  parameters: {
    type: "object",
    properties: {
      address: { type: "string", description: "The top-left cell, or the range the data fills." },
      values: { ...cellMatrixSchema, description: "The rows of values and formulas." },
      numberFormat: numberFormatSchema,
    },
    required: ["address", "values"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const address = requireString(args, "address");
    const values = requireCellMatrix(args, "values");
    const numberFormat = readNumberFormat(args, "numberFormat");
    const rows = values.length;
    const columns = values[0].length;
    const formats = numberFormat === undefined ? undefined : numberFormatMatrix(numberFormat, rows, columns);

    return runExcel(signal, async (context) => {
      const given = getRange(context, address).load("rowCount,columnCount");
      await context.sync();

      const isCell = given.rowCount === 1 && given.columnCount === 1;
      if (!isCell && (given.rowCount !== rows || given.columnCount !== columns)) {
        throw new Error(
          `The range is ${given.rowCount} by ${given.columnCount} cells but the data is ${rows} by ${columns}. ` +
            "Give the top-left cell or a range of the data's size."
        );
      }
      const target = isCell ? given.getAbsoluteResizedRange(rows, columns) : given;
      if (formats) {
        target.numberFormat = formats;
      }
      target.formulas = values;
      target.load("address");
      await context.sync();
      return { address: target.address, rows, columns };
    });
  },
};
