import type { OfficeToolDefinition } from "../../shared/officeTool";
import { normalizeText, POWERPOINT_1_5, runPowerPoint } from "./shared";

export const getSelection: OfficeToolDefinition = {
  name: "powerpoint_get_selection",
  description:
    "Get what the user has selected in PowerPoint: the selected slide ids (the first is the slide shown in the " +
    "editing area), the ids of the selected shapes on that slide, and the selected text (null when no text is " +
    "selected).",
  requires: POWERPOINT_1_5,
  parameters: { type: "object", properties: {}, additionalProperties: false },
  handler: (_args, signal) =>
    runPowerPoint(signal, async (context) => {
      const { presentation } = context;
      const slides = presentation.getSelectedSlides().load("items/id");
      const shapes = presentation.getSelectedShapes().load("items/id");
      const text = presentation.getSelectedTextRangeOrNullObject().load("text");
      await context.sync();
      return {
        slideIds: slides.items.map((slide) => slide.id),
        shapeIds: shapes.items.map((shape) => shape.id),
        text: text.isNullObject ? null : normalizeText(text.text),
      };
    }),
};
