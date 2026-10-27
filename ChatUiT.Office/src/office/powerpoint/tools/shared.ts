/* global AbortSignal, PowerPoint */

import {
  optionalBoolean,
  optionalNumber,
  optionalObject,
  optionalOneOf,
  optionalPositiveNumber,
  optionalString,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";
import type { ErrorHints } from "../../shared/officeError";
import { isSetSupported, type RequirementSet } from "../../shared/officeTool";
import { runBatch } from "../../shared/runBatch";

/** What PowerPoint's error codes mean for the slide and shape ids the tools use. */
const powerPointHints: ErrorHints = {
  ItemNotFound:
    "a slide or shape id may be stale; get current slide ids with powerpoint_get_overview and shape ids with " +
    "powerpoint_read_slide",
};

/** Runs a PowerPoint batch unless the call was cancelled. Office errors are rethrown with PowerPoint's debug info. */
export function runPowerPoint<T>(
  signal: AbortSignal,
  batch: (context: PowerPoint.RequestContext) => Promise<T>
): Promise<T> {
  return runBatch(signal, () => PowerPoint.run(batch), powerPointHints);
}

export const POWERPOINT_1_5: RequirementSet = { set: "PowerPointApi", version: "1.5" };
export const POWERPOINT_1_8: RequirementSet = { set: "PowerPointApi", version: "1.8" };

/** Throws when PowerPoint lacks the API set that one action of a tool needs. */
export function requireSet(requirement: RequirementSet, what: string): void {
  if (!isSetSupported(requirement)) {
    throw new Error(`${what} needs ${requirement.set} ${requirement.version}, which this version of PowerPoint lacks.`);
  }
}

export const slideIdHint = "Slide ids come from powerpoint_get_overview or powerpoint_get_selection.";

/** The ids of the slides in presentation order. */
export async function loadSlideIds(context: PowerPoint.RequestContext): Promise<string[]> {
  const slides = context.presentation.slides;
  slides.load("items/id");
  await context.sync();
  return slides.items.map((slide) => slide.id);
}

export function getShape(context: PowerPoint.RequestContext, slideId: string, shapeId: string): PowerPoint.Shape {
  return context.presentation.slides.getItem(slideId).shapes.getItem(shapeId);
}

/** Shape types whose shapes have a text frame. */
const TEXT_SHAPE_TYPES: readonly string[] = ["GeometricShape", "TextBox", "Callout", "Placeholder"];
/** What a filled placeholder can hold that has no text frame. */
const NON_TEXT_CONTENT: readonly string[] = [
  "Image",
  "Table",
  "Chart",
  "SmartArt",
  "Media",
  "Group",
  "Graphic",
  "ContentApp",
  "Ole",
  "Model3D",
  "Ink",
  "Diagram",
  "Line",
];

export interface ShapeKinds {
  /** The placeholder type of each placeholder shape. Empty without PowerPointApi 1.8. */
  placeholderTypes: Map<PowerPoint.Shape, string>;
  /** The shapes that have a text frame. */
  textShapes: Set<PowerPoint.Shape>;
}

/**
 * Sorts shapes whose `type` is loaded, from one slide or several. Loading the text frame of a shape without one
 * fails the whole batch, so only the text shapes' text frames may be loaded. With PowerPointApi 1.8, placeholders
 * holding a picture, table or other non-text content are left out; before 1.8 every placeholder counts as text.
 */
export async function sortShapes(context: PowerPoint.RequestContext, shapes: PowerPoint.Shape[]): Promise<ShapeKinds> {
  const placeholders = shapes.filter((shape) => shape.type === "Placeholder");
  const placeholderTypes = new Map<PowerPoint.Shape, string>();
  const nonText = new Set<PowerPoint.Shape>();
  if (placeholders.length > 0 && isSetSupported(POWERPOINT_1_8)) {
    placeholders.forEach((shape) => shape.placeholderFormat.load("type,containedType"));
    await context.sync();
    for (const shape of placeholders) {
      const { type, containedType } = shape.placeholderFormat;
      placeholderTypes.set(shape, type);
      if (containedType !== null && NON_TEXT_CONTENT.includes(containedType)) {
        nonText.add(shape);
      }
    }
  }
  return {
    placeholderTypes,
    textShapes: new Set(shapes.filter((shape) => TEXT_SHAPE_TYPES.includes(shape.type) && !nonText.has(shape))),
  };
}

/** Text with \n between paragraphs. PowerPoint may report \r; the tools read and write \n. */
export function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/** Position and size of a shape, as the arguments of a tool. */
export const placementProperties = {
  left: { type: "number", description: "Points from the left edge of the slide." },
  top: { type: "number", description: "Points from the top edge of the slide." },
  width: { type: "number", minimum: 0, description: "Points." },
  height: { type: "number", minimum: 0, description: "Points." },
};

export interface Placement {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

export function readPlacement(args: ToolArguments): Placement {
  const placement: Placement = {
    left: optionalNumber(args, "left"),
    top: optionalNumber(args, "top"),
    width: optionalNumber(args, "width"),
    height: optionalNumber(args, "height"),
  };
  for (const name of ["width", "height"] as const) {
    const value = placement[name];
    if (value !== undefined && value < 0) {
      throw new ToolArgumentError(`"${name}" must be 0 or more.`);
    }
  }
  return placement;
}

export function applyPlacement(shape: PowerPoint.Shape, placement: Placement): void {
  for (const [name, value] of Object.entries(placement) as Array<[keyof Placement, number | undefined]>) {
    if (value !== undefined) {
      shape[name] = value;
    }
  }
}

const TRANSPARENT = "transparent";

export const fillProperty = {
  fillColor: {
    type: "string",
    description: `Fill: #RRGGBB or an HTML color name, or "${TRANSPARENT}" for no fill.`,
  },
};

/** A solid fill color, or null for no fill. */
export function readFill(args: ToolArguments): string | null | undefined {
  const color = optionalString(args, "fillColor");
  if (color === undefined) {
    return undefined;
  }
  if (color.length === 0) {
    throw new ToolArgumentError(`"fillColor" must be a color or "${TRANSPARENT}".`);
  }
  return color.toLowerCase() === TRANSPARENT ? null : color;
}

export function applyFill(shape: PowerPoint.Shape, fill: string | null | undefined): void {
  if (fill === null) {
    shape.fill.clear();
  } else if (fill !== undefined) {
    shape.fill.setSolidColor(fill);
  }
}

const DASH_STYLES = [
  "Solid",
  "Dash",
  "DashDot",
  "DashDotDot",
  "LongDash",
  "LongDashDot",
  "LongDashDotDot",
  "RoundDot",
  "SquareDot",
] as const;

export const lineProperty = {
  line: {
    type: "object",
    description: "The outline of a shape, or the line itself.",
    properties: {
      color: { type: "string", description: "#RRGGBB or an HTML color name." },
      weight: { type: "number", minimum: 0, description: "Points." },
      dashStyle: { type: "string", enum: [...DASH_STYLES] },
      visible: { type: "boolean", description: "false removes the outline." },
    },
    additionalProperties: false,
  },
};

export interface LineFormat {
  color?: string;
  weight?: number;
  dashStyle?: (typeof DASH_STYLES)[number];
  visible?: boolean;
}

export function readLine(args: ToolArguments): LineFormat | undefined {
  const line = optionalObject(args, "line");
  if (!line) {
    return undefined;
  }
  const weight = optionalNumber(line, "weight");
  if (weight !== undefined && weight < 0) {
    throw new ToolArgumentError(`"line.weight" must be 0 or more.`);
  }
  return {
    color: optionalString(line, "color"),
    weight,
    dashStyle: optionalOneOf(line, "dashStyle", DASH_STYLES),
    visible: optionalBoolean(line, "visible"),
  };
}

export function applyLine(shape: PowerPoint.Shape, line: LineFormat | undefined): void {
  if (!line) {
    return;
  }
  const format = shape.lineFormat;
  if (line.visible !== undefined) {
    format.visible = line.visible;
  }
  if (line.color !== undefined) {
    format.color = line.color;
  }
  if (line.weight !== undefined) {
    format.weight = line.weight;
  }
  if (line.dashStyle !== undefined) {
    format.dashStyle = line.dashStyle;
  }
}

const UNDERLINES = [
  "None",
  "Single",
  "Double",
  "Heavy",
  "Dotted",
  "DottedHeavy",
  "Dash",
  "DashHeavy",
  "DashLong",
  "DashLongHeavy",
  "DotDash",
  "DotDashHeavy",
  "DotDotDash",
  "DotDotDashHeavy",
  "Wavy",
  "WavyHeavy",
  "WavyDouble",
] as const;

export const fontProperty = {
  font: {
    type: "object",
    description: "Font of all the text in the shape.",
    properties: {
      name: { type: "string" },
      size: { type: "number", exclusiveMinimum: 0, description: "Points." },
      bold: { type: "boolean" },
      italic: { type: "boolean" },
      underline: { type: "string", enum: [...UNDERLINES] },
      color: { type: "string", description: "#RRGGBB or an HTML color name." },
    },
    additionalProperties: false,
  },
};

export interface FontFormat {
  name?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: (typeof UNDERLINES)[number];
  color?: string;
}

export function readFont(args: ToolArguments): FontFormat | undefined {
  const font = optionalObject(args, "font");
  if (!font) {
    return undefined;
  }
  return {
    name: optionalString(font, "name"),
    size: optionalPositiveNumber(font, "size"),
    bold: optionalBoolean(font, "bold"),
    italic: optionalBoolean(font, "italic"),
    underline: optionalOneOf(font, "underline", UNDERLINES),
    color: optionalString(font, "color"),
  };
}

export function applyFont(font: PowerPoint.ShapeFont, format: FontFormat | undefined): void {
  if (!format) {
    return;
  }
  if (format.name !== undefined) {
    font.name = format.name;
  }
  if (format.size !== undefined) {
    font.size = format.size;
  }
  if (format.bold !== undefined) {
    font.bold = format.bold;
  }
  if (format.italic !== undefined) {
    font.italic = format.italic;
  }
  if (format.underline !== undefined) {
    font.underline = format.underline;
  }
  if (format.color !== undefined) {
    font.color = format.color;
  }
}
