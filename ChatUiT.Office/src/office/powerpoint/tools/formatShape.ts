import { optionalBoolean, optionalString, requireString, ToolArgumentError } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import {
  applyFill,
  applyFont,
  applyLine,
  applyPlacement,
  fillProperty,
  fontProperty,
  getShape,
  lineProperty,
  placementProperties,
  readFill,
  readFont,
  readLine,
  readPlacement,
  runPowerPoint,
} from "./shared";

export const formatShape: OfficeToolDefinition = {
  name: "powerpoint_format_shape",
  description:
    "Change a shape's position and size (points), fill, outline, name, or the font of all its text (shapes with a " +
    "text frame only), or delete the shape with delete: true. For text, bullets and alignment use " +
    `powerpoint_set_text.`,
  parameters: {
    type: "object",
    properties: {
      slideId: { type: "string" },
      shapeId: { type: "string" },
      ...placementProperties,
      ...fillProperty,
      ...lineProperty,
      ...fontProperty,
      name: { type: "string", description: "The shape's name in the selection pane." },
      delete: { type: "boolean", description: "true deletes the shape; give no other change with it." },
    },
    required: ["slideId", "shapeId"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const slideId = requireString(args, "slideId");
    const shapeId = requireString(args, "shapeId");
    const remove = optionalBoolean(args, "delete") ?? false;
    const placement = readPlacement(args);
    const fill = readFill(args);
    const line = readLine(args);
    const font = readFont(args);
    const name = optionalString(args, "name");
    const changes = [...Object.values(placement), fill, line, font, name].filter((value) => value !== undefined);
    if (remove && changes.length > 0) {
      throw new ToolArgumentError(`Give either delete: true or changes, not both.`);
    }
    if (!remove && changes.length === 0) {
      throw new ToolArgumentError("Give at least one change, or delete: true.");
    }
    return runPowerPoint(signal, async (context) => {
      const shape = getShape(context, slideId, shapeId);
      if (remove) {
        shape.delete();
        await context.sync();
        return { slideId, deleted: shapeId };
      }
      applyPlacement(shape, placement);
      applyFill(shape, fill);
      applyLine(shape, line);
      if (font) {
        applyFont(shape.textFrame.textRange.font, font);
      }
      if (name !== undefined) {
        shape.name = name;
      }
      await context.sync();
      return { slideId, shapeId };
    });
  },
};
