/* global PowerPoint */

import { requireString } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { normalizeText, runPowerPoint, sortShapes } from "./shared";

export const readSlide: OfficeToolDefinition = {
  name: "powerpoint_read_slide",
  description:
    "Read the shapes of a slide: id, name, type, left, top, width and height in " +
    "points, and for shapes with a text frame the text (paragraphs separated by \\n), the font (name, size, bold, " +
    "italic, underline, color; null when mixed) and the fill (a color, none, or the fill type).",
  parameters: {
    type: "object",
    properties: { slideId: { type: "string" } },
    required: ["slideId"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const slideId = requireString(args, "slideId");
    return runPowerPoint(signal, async (context) => {
      const shapes = context.presentation.slides.getItem(slideId).shapes;
      shapes.load("items/id,items/name,items/type,items/left,items/top,items/width,items/height");
      await context.sync();

      const { textShapes } = await sortShapes(context, shapes.items);
      textShapes.forEach((shape) => {
        shape.textFrame.textRange.load("text");
        shape.textFrame.textRange.font.load("name,size,bold,italic,underline,color");
        shape.fill.load("type,foregroundColor");
      });
      await context.sync();

      return {
        slideId,
        shapes: shapes.items.map((shape) => ({
          id: shape.id,
          name: shape.name,
          type: shape.type,
          left: shape.left,
          top: shape.top,
          width: shape.width,
          height: shape.height,
          ...(textShapes.has(shape) ? textDetails(shape) : {}),
        })),
      };
    });
  },
};

function textDetails(shape: PowerPoint.Shape) {
  const { text, font } = shape.textFrame.textRange;
  const { fill } = shape;
  return {
    text: normalizeText(text),
    font: {
      name: font.name ?? null,
      size: font.size ?? null,
      bold: font.bold ?? null,
      italic: font.italic ?? null,
      underline: font.underline ?? null,
      color: font.color ?? null,
    },
    fill: fill.type === "Solid" ? fill.foregroundColor : fill.type === "NoFill" ? "none" : fill.type,
  };
}
