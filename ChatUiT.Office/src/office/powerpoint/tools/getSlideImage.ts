import { optionalString } from "../../../chat/tools/args";
import { ToolResultWithImages } from "../../../chat/tools/types";
import { toModelImage } from "../../shared/image";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { runPowerPoint, slideIdHint } from "./shared";

/** Wide enough to read the text on a slide, and below the longest edge sent to the model. */
const IMAGE_WIDTH = 1600;

export const getSlideImage: OfficeToolDefinition = {
  name: "powerpoint_get_slide_image",
  description:
    "See a slide as the user sees it, as a picture. Without slideId: the first selected slide, or the first " +
    "slide.",
  requires: { set: "PowerPointApi", version: "1.8" },
  parameters: {
    type: "object",
    properties: { slideId: { type: "string" } },
    additionalProperties: false,
  },
  handler: async (args, signal) => {
    const slideId = optionalString(args, "slideId");
    const shot = await runPowerPoint(signal, async (context) => {
      const slides = context.presentation.slides.load("items/id");
      const selected = context.presentation.getSelectedSlides().load("items/id");
      await context.sync();
      const id = slideId || selected.items[0]?.id || slides.items[0]?.id;
      if (!id) {
        return null;
      }
      const index = slides.items.findIndex((slide) => slide.id === id);
      if (index < 0) {
        throw new Error(`Slide "${id}" was not found. ${slideIdHint}`);
      }
      const image = slides.items[index].getImageAsBase64({ width: IMAGE_WIDTH });
      await context.sync();
      return { slideId: id, slide: index + 1, base64: image.value };
    });
    if (!shot) {
      return { note: "The presentation has no slides." };
    }
    return new ToolResultWithImages({ slideId: shot.slideId, slide: shot.slide }, [await toModelImage(shot.base64)]);
  },
};
