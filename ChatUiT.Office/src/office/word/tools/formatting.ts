/* global Word */

import {
  optionalBoolean,
  optionalInteger,
  optionalNumber,
  optionalObject,
  optionalOneOf,
  optionalPositiveNumber,
  optionalString,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";

/** Font and paragraph properties shared by word_format_text, word_format_paragraphs and word_define_style. */

const UNDERLINES = [
  "None",
  "Single",
  "Word",
  "Double",
  "Thick",
  "Dotted",
  "DottedHeavy",
  "DashLine",
  "DashLineHeavy",
  "DashLineLong",
  "DashLineLongHeavy",
  "DotDashLine",
  "DotDashLineHeavy",
  "TwoDotDashLine",
  "TwoDotDashLineHeavy",
  "Wave",
  "WaveHeavy",
  "WaveDouble",
] as const;

/** The highlight colors every Word host supports. */
const HIGHLIGHTS = [
  "None",
  "Yellow",
  "Lime",
  "Turquoise",
  "Pink",
  "Blue",
  "Red",
  "DarkBlue",
  "Teal",
  "Green",
  "Purple",
  "DarkRed",
  "Olive",
  "Gray",
  "LightGray",
  "Black",
] as const;

const FONT_BOOLEANS = [
  "bold",
  "italic",
  "strikeThrough",
  "doubleStrikeThrough",
  "superscript",
  "subscript",
  "smallCaps",
  "allCaps",
] as const;

export const fontProperties = {
  name: { type: "string", description: "Font name." },
  size: { type: "number", exclusiveMinimum: 0, description: "Size in points." },
  bold: { type: "boolean" },
  italic: { type: "boolean" },
  underline: { type: "string", enum: [...UNDERLINES] },
  color: { type: "string", description: "Text color: #RRGGBB or a color name." },
  highlight: { type: "string", enum: [...HIGHLIGHTS], description: "None removes the highlight." },
  strikeThrough: { type: "boolean" },
  doubleStrikeThrough: { type: "boolean" },
  superscript: { type: "boolean" },
  subscript: { type: "boolean" },
  smallCaps: { type: "boolean" },
  allCaps: { type: "boolean" },
};

export interface FontFormat {
  name?: string;
  size?: number;
  underline?: (typeof UNDERLINES)[number];
  color?: string;
  highlight?: (typeof HIGHLIGHTS)[number];
  booleans: Partial<Record<(typeof FONT_BOOLEANS)[number], boolean>>;
}

export function readFont(args: ToolArguments): FontFormat {
  const size = optionalPositiveNumber(args, "size");
  const booleans: FontFormat["booleans"] = {};
  for (const name of FONT_BOOLEANS) {
    const value = optionalBoolean(args, name);
    if (value !== undefined) {
      booleans[name] = value;
    }
  }
  return {
    name: optionalString(args, "name"),
    size,
    underline: optionalOneOf(args, "underline", UNDERLINES),
    color: optionalString(args, "color"),
    highlight: optionalOneOf(args, "highlight", HIGHLIGHTS),
    booleans,
  };
}

export function isEmptyFont(format: FontFormat): boolean {
  const { booleans, ...rest } = format;
  return Object.keys(booleans).length === 0 && Object.values(rest).every((value) => value === undefined);
}

export function applyFont(font: Word.Font, format: FontFormat): void {
  if (format.name !== undefined) {
    font.name = format.name;
  }
  if (format.size !== undefined) {
    font.size = format.size;
  }
  if (format.underline !== undefined) {
    font.underline = format.underline;
  }
  if (format.color !== undefined) {
    font.color = format.color;
  }
  if (format.highlight !== undefined) {
    // Word removes the highlight when it is set to null, which its typings do not allow.
    font.highlightColor = format.highlight === "None" ? (null as unknown as string) : format.highlight;
  }
  for (const [name, value] of Object.entries(format.booleans)) {
    font[name as (typeof FONT_BOOLEANS)[number]] = value;
  }
}

const ALIGNMENTS = ["Left", "Centered", "Right", "Justified"] as const;
const BORDER_STYLES = ["none", "single", "double", "dotted", "dashed"] as const;
const BORDER_WIDTHS = [0.25, 0.5, 0.75, 1, 1.5, 2.25, 3, 4.5, 6] as const;
const PARAGRAPH_NUMBERS = ["leftIndent", "rightIndent", "firstLineIndent", "spaceBefore", "spaceAfter"] as const;

export const paragraphProperties = {
  alignment: { type: "string", enum: [...ALIGNMENTS] },
  leftIndent: { type: "number", description: "Points." },
  rightIndent: { type: "number", description: "Points." },
  firstLineIndent: { type: "number", description: "Points. Negative for a hanging indent." },
  spaceBefore: { type: "number", minimum: 0, description: "Points." },
  spaceAfter: { type: "number", minimum: 0, description: "Points." },
  lineSpacing: {
    type: "number",
    exclusiveMinimum: 0,
    description: "Points: 12 is single, 18 is 1.5 lines and 24 is double spacing.",
  },
  outlineLevel: { type: "integer", minimum: 1, maximum: 10, description: "1 to 9, or 10 for body text." },
  shading: { type: "string", description: "Background color: #RRGGBB." },
  border: {
    type: "object",
    description: "A border on every side of the paragraphs.",
    properties: {
      style: { type: "string", enum: [...BORDER_STYLES] },
      width: { type: "number", enum: [...BORDER_WIDTHS], description: "Points." },
      color: { type: "string", description: "#RRGGBB." },
    },
    required: ["style"],
    additionalProperties: false,
  },
};

export interface BorderFormat {
  style: (typeof BORDER_STYLES)[number];
  width?: (typeof BORDER_WIDTHS)[number];
  color?: string;
}

export interface ParagraphFormat {
  alignment?: (typeof ALIGNMENTS)[number];
  numbers: Partial<Record<(typeof PARAGRAPH_NUMBERS)[number], number>>;
  lineSpacing?: number;
  outlineLevel?: number;
  shading?: string;
  border?: BorderFormat;
}

export function readParagraphFormat(args: ToolArguments): ParagraphFormat {
  const numbers: ParagraphFormat["numbers"] = {};
  for (const name of PARAGRAPH_NUMBERS) {
    const value = optionalNumber(args, name);
    if (value !== undefined) {
      numbers[name] = value;
    }
  }
  const outlineLevel = optionalInteger(args, "outlineLevel");
  if (outlineLevel !== undefined && (outlineLevel < 1 || outlineLevel > 10)) {
    throw new ToolArgumentError(`"outlineLevel" must be an integer from 1 to 10.`);
  }
  const lineSpacing = optionalPositiveNumber(args, "lineSpacing");
  return {
    alignment: optionalOneOf(args, "alignment", ALIGNMENTS),
    numbers,
    lineSpacing,
    outlineLevel,
    shading: optionalString(args, "shading"),
    border: readBorder(optionalObject(args, "border")),
  };
}

function readBorder(args: ToolArguments | undefined): BorderFormat | undefined {
  if (!args) {
    return undefined;
  }
  const width = optionalNumber(args, "width");
  if (width !== undefined && !(BORDER_WIDTHS as readonly number[]).includes(width)) {
    throw new ToolArgumentError(`"border.width" must be one of: ${BORDER_WIDTHS.join(", ")}.`);
  }
  const style = optionalOneOf(args, "style", BORDER_STYLES);
  if (!style) {
    throw new ToolArgumentError(`"border.style" must be one of: ${BORDER_STYLES.join(", ")}.`);
  }
  return { style, width: width as BorderFormat["width"], color: optionalString(args, "color") };
}

export function isEmptyParagraphFormat(format: ParagraphFormat): boolean {
  const { numbers, ...rest } = format;
  return Object.keys(numbers).length === 0 && Object.values(rest).every((value) => value === undefined);
}

/** Line width names of Word.LineWidth and Word.BorderWidth, such as "Pt025" for 0.25 points. */
function widthName(width: number): Word.LineWidth & Word.BorderWidth {
  return `Pt${String(Math.round(width * 100)).padStart(3, "0")}` as Word.LineWidth & Word.BorderWidth;
}

/**
 * Applies the format to a paragraph. With a border, load `paragraph.borders` items first.
 */
export function applyParagraphFormat(paragraph: Word.Paragraph, format: ParagraphFormat): void {
  applyCommonParagraphFormat(paragraph, format);
  if (format.outlineLevel !== undefined) {
    paragraph.outlineLevel = format.outlineLevel;
  }
  if (format.shading !== undefined) {
    paragraph.shading.backgroundPatternColor = format.shading;
  }
  const { border } = format;
  if (border) {
    const lineStyles: Record<BorderFormat["style"], Word.BorderLineStyle> = {
      none: Word.BorderLineStyle.none,
      single: Word.BorderLineStyle.single,
      double: Word.BorderLineStyle.double,
      dotted: Word.BorderLineStyle.dot,
      dashed: Word.BorderLineStyle.dashSmallGap,
    };
    for (const side of paragraph.borders.items) {
      side.isVisible = border.style !== "none";
      side.lineStyle = lineStyles[border.style];
      if (border.width !== undefined) {
        side.lineWidth = widthName(border.width);
      }
      if (border.color !== undefined) {
        side.color = border.color;
      }
    }
  }
}

/** Applies the format to a style. */
export function applyStyleParagraphFormat(style: Word.Style, format: ParagraphFormat): void {
  applyCommonParagraphFormat(style.paragraphFormat, format);
  if (format.outlineLevel !== undefined) {
    style.paragraphFormat.outlineLevel =
      format.outlineLevel === 10
        ? Word.OutlineLevel.outlineLevelBodyText
        : (`OutlineLevel${format.outlineLevel}` as Word.OutlineLevel);
  }
  if (format.shading !== undefined) {
    style.shading.backgroundPatternColor = format.shading;
  }
  const { border } = format;
  if (border) {
    const types: Record<BorderFormat["style"], Word.BorderType> = {
      none: Word.BorderType.none,
      single: Word.BorderType.single,
      double: Word.BorderType.double,
      dotted: Word.BorderType.dotted,
      dashed: Word.BorderType.dashed,
    };
    style.borders.outsideBorderType = types[border.style];
    if (border.width !== undefined) {
      style.borders.outsideBorderWidth = widthName(border.width);
    }
    if (border.color !== undefined) {
      style.borders.outsideBorderColor = border.color;
    }
  }
}

function applyCommonParagraphFormat(target: Word.Paragraph | Word.ParagraphFormat, format: ParagraphFormat): void {
  if (format.alignment !== undefined) {
    target.alignment = format.alignment;
  }
  for (const [name, value] of Object.entries(format.numbers)) {
    target[name as (typeof PARAGRAPH_NUMBERS)[number]] = value;
  }
  if (format.lineSpacing !== undefined) {
    target.lineSpacing = format.lineSpacing;
  }
}
