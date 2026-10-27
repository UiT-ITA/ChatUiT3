import { requireString } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { loadTable } from "./tableShared";
import { runWord } from "./shared";

export const readTable: OfficeToolDefinition = {
  name: "word_read_table",
  description:
    "Read the table that contains a paragraph: cell values, row count, style, header rows, banding options and " +
    `nesting level. Table paragraph ids come from word_get_overview.`,
  parameters: {
    type: "object",
    properties: { paragraphId: { type: "string", description: "Any paragraph in the table." } },
    required: ["paragraphId"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const paragraphId = requireString(args, "paragraphId");

    return runWord(signal, async (context) => {
      const table = await loadTable(context, paragraphId);
      table.load(
        "values,rowCount,style,headerRowCount,nestingLevel,styleBandedRows,styleBandedColumns," +
          "styleFirstColumn,styleLastColumn,styleTotalRow"
      );
      await context.sync();
      return {
        rows: table.rowCount,
        values: table.values,
        style: table.style,
        headerRows: table.headerRowCount,
        nestingLevel: table.nestingLevel,
        bandedRows: table.styleBandedRows,
        bandedColumns: table.styleBandedColumns,
        firstColumn: table.styleFirstColumn,
        lastColumn: table.styleLastColumn,
        totalRow: table.styleTotalRow,
      };
    });
  },
};
