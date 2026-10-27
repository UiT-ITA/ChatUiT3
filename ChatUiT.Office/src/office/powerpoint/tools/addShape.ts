import {
  optionalOneOf,
  optionalString,
  requireOneOf,
  requireString,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import {
  applyFill,
  applyFont,
  applyLine,
  fillProperty,
  fontProperty,
  lineProperty,
  normalizeText,
  placementProperties,
  readFill,
  readFont,
  readLine,
  readPlacement,
  runPowerPoint,
} from "./shared";

const KINDS = ["geometric", "textbox", "line"] as const;

/** Common values of PowerPoint.GeometricShapeType. */
const GEOMETRIC_SHAPES = [
  "Rectangle",
  "RoundRectangle",
  "Ellipse",
  "Triangle",
  "RightTriangle",
  "Diamond",
  "Parallelogram",
  "Trapezoid",
  "Pentagon",
  "Hexagon",
  "Octagon",
  "Star5",
  "RightArrow",
  "LeftArrow",
  "UpArrow",
  "DownArrow",
  "LeftRightArrow",
  "Chevron",
  "HomePlate",
  "Plus",
  "Donut",
  "Heart",
  "Cloud",
  "WedgeRectCallout",
  "WedgeRRectCallout",
  "WedgeEllipseCallout",
  "FlowChartProcess",
  "FlowChartDecision",
  "FlowChartTerminator",
  "FlowChartDocument",
] as const;

export const addShape: OfficeToolDefinition = {
  name: "powerpoint_add_shape",
  description:
    "Add a geometric shape, a text box or a straight line to a slide and return its id. Position and size are in " +
    "points; a line runs from (left, top) across its width and height, so height 0 is a horizontal line. text and " +
    `font are for geometric shapes and text boxes. Format the shape later with powerpoint_format_shape.`,
  parameters: {
    type: "object",
    properties: {
      slideId: { type: "string" },
      kind: { type: "string", enum: [...KINDS] },
      shape: { type: "string", enum: [...GEOMETRIC_SHAPES], description: "Required when kind is geometric." },
      ...placementProperties,
      ...fillProperty,
      ...lineProperty,
      text: { type: "string", description: "Each line becomes a paragraph." },
      ...fontProperty,
    },
    required: ["slideId", "kind"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const slideId = requireString(args, "slideId");
    const kind = readKind(args);
    const placement = readPlacement(args);
    const fill = readFill(args);
    const line = readLine(args);
    const text = optionalString(args, "text");
    const font = readFont(args);
    if (kind.kind === "line" && (text !== undefined || font !== undefined)) {
      throw new ToolArgumentError(`A line has no text: leave out "text" and "font".`);
    }
    return runPowerPoint(signal, async (context) => {
      const shapes = context.presentation.slides.getItem(slideId).shapes;
      const shape =
        kind.kind === "geometric"
          ? shapes.addGeometricShape(kind.shape, placement)
          : kind.kind === "line"
            ? shapes.addLine("Straight", placement)
            : shapes.addTextBox(normalizeText(text ?? ""), placement);
      if (kind.kind === "geometric" && text !== undefined) {
        shape.textFrame.textRange.text = normalizeText(text);
      }
      applyFill(shape, fill);
      applyLine(shape, line);
      if (font) {
        applyFont(shape.textFrame.textRange.font, font);
      }
      shape.load("id");
      await context.sync();
      return { slideId, shapeId: shape.id };
    });
  },
};

type ShapeKind = { kind: "geometric"; shape: (typeof GEOMETRIC_SHAPES)[number] } | { kind: "textbox" | "line" };

function readKind(args: ToolArguments): ShapeKind {
  const kind = requireOneOf(args, "kind", KINDS);
  if (kind !== "geometric") {
    return { kind };
  }
  const shape = optionalOneOf(args, "shape", GEOMETRIC_SHAPES);
  if (!shape) {
    throw new ToolArgumentError(`"shape" is required when kind is "geometric".`);
  }
  return { kind, shape };
}
