import { optionalInteger, optionalString, requireStringMatrix, ToolArgumentError } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { applyBanding, bandingProperties, readBanding } from "./tableShared";
import {
  applyStyleName,
  deleteReplaced,
  locationProperties,
  readInsertLocation,
  resolveBlockLocation,
  runWord,
  styleNameHint,
} from "./shared";

export const insertTable: OfficeToolDefinition = {
  name: "word_insert_table",
  description:
    "Insert a table from rows of cell values, with header rows, a table style and banding options. Returns the id " +
    `of the first paragraph of the table, for word_read_table and word_edit_table. ` +
    `${styleNameHint}`,
  parameters: {
    type: "object",
    properties: {
      ...locationProperties,
      values: {
        type: "array",
        items: { type: "array", items: { type: "string" } },
        description: "The rows of cell values. Shorter rows are padded with empty cells.",
      },
      headerRows: { type: "integer", minimum: 0, description: "Rows repeated as header. Default 1." },
      style: { type: "string", description: "A table style, such as GridTable4_Accent1." },
      ...bandingProperties,
    },
    required: ["location", "values"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const location = readInsertLocation(args);
    const rows = requireStringMatrix(args, "values");
    const headerRows = optionalInteger(args, "headerRows") ?? 1;
    if (headerRows < 0 || headerRows > rows.length) {
      throw new ToolArgumentError(`"headerRows" must be from 0 to the number of rows.`);
    }
    const style = optionalString(args, "style");
    const banding = readBanding(args);
    const columns = Math.max(...rows.map((row) => row.length));
    if (columns === 0) {
      throw new ToolArgumentError(`"values" must have at least one cell.`);
    }
    const values = rows.map((row) => Array.from({ length: columns }, (_, index) => row[index] ?? ""));

    return runWord(signal, async (context) => {
      const block = await resolveBlockLocation(context, location);
      const { anchor } = block;
      const table =
        "body" in anchor
          ? anchor.body.insertTable(values.length, columns, anchor.location, values)
          : anchor.paragraph.insertTable(values.length, columns, anchor.location, values);
      table.headerRowCount = headerRows;
      if (style) {
        applyStyleName(table, style);
      }
      applyBanding(table, banding);
      deleteReplaced(block);
      const first = table.getCell(0, 0).body.paragraphs.getFirst().load("uniqueLocalId");
      await context.sync();
      return { tableParagraphId: first.uniqueLocalId, rows: values.length, columns };
    });
  },
};
