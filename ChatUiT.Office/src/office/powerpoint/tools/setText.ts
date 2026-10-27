import {
  optionalBoolean,
  optionalOneOf,
  optionalString,
  requireString,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { applyFont, fontProperty, getShape, normalizeText, readFont, runPowerPoint } from "./shared";

const ALIGNMENTS = ["Left", "Center", "Right", "Justify"] as const;
const VERTICAL_ALIGNMENTS = ["Top", "Middle", "Bottom", "TopCentered", "MiddleCentered", "BottomCentered"] as const;

export const setText: OfficeToolDefinition = {
  name: "powerpoint_set_text",
  description:
    "Replace the text of a shape with a text frame (a placeholder, text box or geometric shape) and format all " +
    "its text. Each line of text becomes a paragraph. Without text, only the formatting changes. The *Centered " +
    `vertical alignments also center the text block horizontally.`,
  parameters: {
    type: "object",
    properties: {
      slideId: { type: "string" },
      shapeId: { type: "string" },
      text: { type: "string" },
      ...fontProperty,
      bullets: { type: "boolean", description: "Show or hide bullets on every paragraph." },
      alignment: { type: "string", enum: [...ALIGNMENTS], description: "Paragraph alignment." },
      verticalAlignment: { type: "string", enum: [...VERTICAL_ALIGNMENTS] },
    },
    required: ["slideId", "shapeId"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const slideId = requireString(args, "slideId");
    const shapeId = requireString(args, "shapeId");
    const text = optionalString(args, "text");
    const font = readFont(args);
    const bullets = optionalBoolean(args, "bullets");
    const alignment = optionalOneOf(args, "alignment", ALIGNMENTS);
    const verticalAlignment = optionalOneOf(args, "verticalAlignment", VERTICAL_ALIGNMENTS);
    if ([text, font, bullets, alignment, verticalAlignment].every((value) => value === undefined)) {
      throw new ToolArgumentError("Give text or at least one formatting property.");
    }
    return runPowerPoint(signal, async (context) => {
      const textFrame = getShape(context, slideId, shapeId).textFrame;
      const range = textFrame.textRange;
      if (text !== undefined) {
        range.text = normalizeText(text);
      }
      applyFont(range.font, font);
      if (bullets !== undefined) {
        range.paragraphFormat.bulletFormat.visible = bullets;
      }
      if (alignment !== undefined) {
        range.paragraphFormat.horizontalAlignment = alignment;
      }
      if (verticalAlignment !== undefined) {
        textFrame.verticalAlignment = verticalAlignment;
      }
      await context.sync();
      return { slideId, shapeId };
    });
  },
};
