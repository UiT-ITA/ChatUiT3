/* global PowerPoint */

import {
  optionalBoolean,
  optionalObject,
  optionalString,
  requireString,
  requireStringMatrix,
} from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { placementProperties, POWERPOINT_1_8, readPlacement, runPowerPoint } from "./shared";

export const insertTable: OfficeToolDefinition = {
  name: "powerpoint_insert_table",
  description:
    "Add a table to a slide and return its shape id. values are the rows of cell text; shorter rows are padded " +
    "with empty cells. Position and size are in points; without left the table is centered. header formats the " +
    `first row.`,
  requires: POWERPOINT_1_8,
  parameters: {
    type: "object",
    properties: {
      slideId: { type: "string" },
      values: {
        type: "array",
        minItems: 1,
        items: { type: "array", items: { type: "string" } },
        description: "Rows of cell text.",
      },
      ...placementProperties,
      header: {
        type: "object",
        description: "Formatting of the first row.",
        properties: {
          bold: { type: "boolean" },
          color: { type: "string", description: "Text color: #RRGGBB or an HTML color name." },
          fillColor: { type: "string", description: "Cell fill: #RRGGBB or an HTML color name." },
        },
        additionalProperties: false,
      },
    },
    required: ["slideId", "values"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const slideId = requireString(args, "slideId");
    const rows = requireStringMatrix(args, "values");
    const columnCount = Math.max(1, ...rows.map((row) => row.length));
    const values = rows.map((row) => [...row, ...Array<string>(columnCount - row.length).fill("")]);
    const placement = readPlacement(args);
    const header = readHeader(optionalObject(args, "header"));

    const options: PowerPoint.TableAddOptions = { ...placement, values };
    if (header) {
      options.specificCellProperties = values.map((_row, index) =>
        Array.from({ length: columnCount }, () => (index === 0 ? header : {}))
      );
    }
    return runPowerPoint(signal, async (context) => {
      const shape = context.presentation.slides.getItem(slideId).shapes.addTable(values.length, columnCount, options);
      shape.load("id");
      await context.sync();
      return { slideId, shapeId: shape.id, rows: values.length, columns: columnCount };
    });
  },
};

function readHeader(args: ToolArguments | undefined): PowerPoint.TableCellProperties | undefined {
  if (!args) {
    return undefined;
  }
  const bold = optionalBoolean(args, "bold");
  const color = optionalString(args, "color");
  const fillColor = optionalString(args, "fillColor");
  const cell: PowerPoint.TableCellProperties = {};
  if (bold !== undefined || color !== undefined) {
    cell.font = { bold, color };
  }
  if (fillColor !== undefined) {
    cell.fill = { color: fillColor };
  }
  return cell.font || cell.fill ? cell : undefined;
}
