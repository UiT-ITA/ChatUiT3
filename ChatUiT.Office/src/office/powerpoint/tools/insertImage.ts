/* global Office */

import { optionalNumber, optionalPositiveNumber, optionalString, ToolArgumentError } from "../../../chat/tools/args";
import { callAsync } from "../../shared/callAsync";
import { imageSourceProperties, readImageSource } from "../../shared/image";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { loadSlideIds, runPowerPoint, slideIdHint } from "./shared";

export const insertImage: OfficeToolDefinition = {
  name: "powerpoint_insert_image",
  description:
    "Insert a picture from Base64 data or from an http(s) URL, which the add-in downloads. It goes on the slide " +
    "shown in PowerPoint: give slideId to go to that slide first. With no position or size, it replaces a " +
    "placeholder on the slide when there is one. Position and size are in points; left and top go together, and giving only width " +
    `or height keeps the aspect ratio.`,
  parameters: {
    type: "object",
    properties: {
      slideId: { type: "string", description: "Go to this slide before inserting." },
      ...imageSourceProperties,
      left: { type: "number" },
      top: { type: "number" },
      width: { type: "number", exclusiveMinimum: 0 },
      height: { type: "number", exclusiveMinimum: 0 },
    },
    additionalProperties: false,
  },
  handler: async (args, signal) => {
    const slideId = optionalString(args, "slideId") || undefined;
    const left = optionalNumber(args, "left");
    const top = optionalNumber(args, "top");
    if ((left === undefined) !== (top === undefined)) {
      throw new ToolArgumentError(`Give "left" and "top" together.`);
    }
    const width = optionalPositiveNumber(args, "width");
    const height = optionalPositiveNumber(args, "height");
    const image = await readImageSource(args, signal);

    if (slideId) {
      const ids = await runPowerPoint(signal, loadSlideIds);
      const index = ids.indexOf(slideId);
      if (index < 0) {
        throw new Error(`Slide "${slideId}" was not found. ${slideIdHint}`);
      }
      // GoToType.Index takes the 1-based slide number.
      await callAsync((callback) => Office.context.document.goToByIdAsync(index + 1, Office.GoToType.Index, callback));
    }
    if (signal.aborted) {
      throw new Error("Cancelled.");
    }
    await callAsync<void>((callback) =>
      Office.context.document.setSelectedDataAsync(
        image,
        {
          coercionType: Office.CoercionType.Image,
          imageLeft: left,
          imageTop: top,
          imageWidth: width,
          imageHeight: height,
        },
        callback
      )
    );
    return { inserted: true, slideId: slideId ?? null };
  },
};
