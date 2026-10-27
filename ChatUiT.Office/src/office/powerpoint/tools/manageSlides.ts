/* global PowerPoint */

import {
  optionalInteger,
  optionalStringArray,
  requireOneOf,
  requireString,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { loadSlideIds, POWERPOINT_1_8, requireSet, runPowerPoint } from "./shared";

const ACTIONS = ["delete", "move", "duplicate"] as const;

export const manageSlides: OfficeToolDefinition = {
  name: "powerpoint_manage_slides",
  description:
    "delete: remove the slides slideIds. move: move the slide slideId to the zero-based index. duplicate: copy " +
    "the slide slideId to right after it and return the copy's id. move and duplicate need a recent PowerPoint.",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: [...ACTIONS] },
      slideIds: { type: "array", items: { type: "string" }, minItems: 1, description: "For delete." },
      slideId: { type: "string", description: "For move and duplicate." },
      index: { type: "integer", minimum: 0, description: "For move: the new zero-based position." },
    },
    required: ["action"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const action = requireOneOf(args, "action", ACTIONS);
    switch (action) {
      case "delete": {
        const slideIds = optionalStringArray(args, "slideIds");
        if (!slideIds || slideIds.length === 0) {
          throw new ToolArgumentError(`"slideIds" must be a non-empty array of slide ids for delete.`);
        }
        return runPowerPoint(signal, async (context) => {
          slideIds.forEach((id) => context.presentation.slides.getItem(id).delete());
          await context.sync();
          return { deleted: slideIds };
        });
      }
      case "move": {
        const slideId = requireString(args, "slideId");
        const index = optionalInteger(args, "index");
        if (index === undefined || index < 0) {
          throw new ToolArgumentError(`"index" must be an integer of 0 or more for move.`);
        }
        requireSet(POWERPOINT_1_8, "Moving a slide");
        return runPowerPoint(signal, async (context) => {
          const ids = await loadSlideIds(context);
          if (index >= ids.length) {
            throw new ToolArgumentError(`"index" must be less than the slide count, ${ids.length}.`);
          }
          context.presentation.slides.getItem(slideId).moveTo(index);
          await context.sync();
          return { slideId, index };
        });
      }
      case "duplicate": {
        const slideId = requireString(args, "slideId");
        requireSet(POWERPOINT_1_8, "Duplicating a slide");
        return runPowerPoint(signal, (context) => duplicate(context, slideId));
      }
    }
  },
};

async function duplicate(context: PowerPoint.RequestContext, slideId: string) {
  const before = new Set(await loadSlideIds(context));
  const exported = context.presentation.slides.getItem(slideId).exportAsBase64();
  await context.sync();
  context.presentation.insertSlidesFromBase64(exported.value, {
    targetSlideId: slideId,
    formatting: PowerPoint.InsertSlideFormatting.keepSourceFormatting,
  });
  await context.sync();
  const after = await loadSlideIds(context);
  const index = after.findIndex((id) => !before.has(id));
  if (index < 0) {
    throw new Error("PowerPoint did not report the copied slide.");
  }
  return { slideId: after[index], index };
}
