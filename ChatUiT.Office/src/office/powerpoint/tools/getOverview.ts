/* global PowerPoint */

import { isSetSupported, type OfficeToolDefinition } from "../../shared/officeTool";
import { normalizeText, POWERPOINT_1_5, runPowerPoint, sortShapes } from "./shared";

const MAX_TITLE_LENGTH = 200;
const TITLE_PLACEHOLDERS: readonly string[] = ["Title", "CenterTitle", "VerticalTitle"];

export const getOverview: OfficeToolDefinition = {
  name: "powerpoint_get_overview",
  description:
    "Get the slides in order (id, zero-based index, layout name, title text and shape count), the slide masters " +
    "with their layouts (id, name) for powerpoint_add_slide, and the ids of the selected slides when PowerPoint " +
    "reports them. The title is the text of the title placeholder, or else of the first shape with text. Read a " +
    "slide's shapes with powerpoint_read_slide.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  handler: (_args, signal) =>
    runPowerPoint(signal, async (context) => {
      const { presentation } = context;
      const slides = presentation.slides;
      slides.load("items/id");
      const masters = presentation.slideMasters;
      masters.load("items/id,items/name");
      const selected = isSetSupported(POWERPOINT_1_5) ? presentation.getSelectedSlides().load("items/id") : null;
      await context.sync();

      slides.items.forEach((slide) => {
        slide.layout.load("name");
        slide.shapes.load("items/id,items/type");
      });
      masters.items.forEach((master) => master.layouts.load("items/id,items/name"));
      await context.sync();

      const { placeholderTypes, textShapes } = await sortShapes(
        context,
        slides.items.flatMap((slide) => slide.shapes.items)
      );
      const isTitle = (shape: PowerPoint.Shape) => TITLE_PLACEHOLDERS.includes(placeholderTypes.get(shape) ?? "");
      const titleShapes = slides.items.map((slide) => {
        const candidates = slide.shapes.items.filter((shape) => textShapes.has(shape));
        // The title placeholder first, then the other shapes in order.
        const ordered = [...candidates.filter(isTitle), ...candidates.filter((shape) => !isTitle(shape))];
        ordered.forEach((shape) => shape.textFrame.textRange.load("text"));
        return ordered;
      });
      await context.sync();

      return {
        slides: slides.items.map((slide, index) => ({
          id: slide.id,
          index,
          layout: slide.layout.name,
          title: titleOf(titleShapes[index]),
          shapeCount: slide.shapes.items.length,
        })),
        slideMasters: masters.items.map((master) => ({
          id: master.id,
          name: master.name,
          layouts: master.layouts.items.map((layout) => ({ id: layout.id, name: layout.name })),
        })),
        selectedSlideIds: selected ? selected.items.map((slide) => slide.id) : null,
      };
    }),
};

function titleOf(shapes: PowerPoint.Shape[]): string | null {
  const text = shapes.map((shape) => shape.textFrame.textRange.text.trim()).find((value) => value.length > 0);
  return text === undefined ? null : normalizeText(text).slice(0, MAX_TITLE_LENGTH);
}
