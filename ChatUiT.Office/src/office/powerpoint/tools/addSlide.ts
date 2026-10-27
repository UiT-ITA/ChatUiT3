import { optionalString } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { loadSlideIds, runPowerPoint } from "./shared";

export const addSlide: OfficeToolDefinition = {
  name: "powerpoint_add_slide",
  description:
    "Add a slide and return its id and zero-based index. layoutId and slideMasterId come from " +
    "powerpoint_get_overview. Without slideMasterId, the previous slide's master is used, and a layoutId must " +
    "belong to that master; with only slideMasterId, its first layout is used. Move the slide with " +
    "powerpoint_manage_slides.",
  parameters: {
    type: "object",
    properties: {
      layoutId: { type: "string" },
      slideMasterId: { type: "string" },
    },
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const layoutId = optionalString(args, "layoutId") || undefined;
    const slideMasterId = optionalString(args, "slideMasterId") || undefined;
    return runPowerPoint(signal, async (context) => {
      const before = new Set(await loadSlideIds(context));
      context.presentation.slides.add({ layoutId, slideMasterId });
      await context.sync();
      const after = await loadSlideIds(context);
      const index = after.findIndex((id) => !before.has(id));
      if (index < 0) {
        throw new Error("PowerPoint did not report the new slide.");
      }
      return { slideId: after[index], index };
    });
  },
};
