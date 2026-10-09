import {
  optionalBoolean,
  optionalObject,
  optionalOneOf,
  optionalString,
  requireString,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import {
  applyFont,
  applyStyleParagraphFormat,
  fontProperties,
  paragraphProperties,
  readFont,
  readParagraphFormat,
} from "./formatting";
import { runWord } from "./shared";

const TYPES = ["Paragraph", "Character", "Table", "List"] as const;

export const defineStyle: OfficeToolDefinition = {
  name: "word_define_style",
  description:
    "Create a style, or modify an existing one, by name: font, paragraph format, base style and the style of the " +
    "next paragraph. type is required to create. Apply the style with word_set_style or word_edit_table.",
  requires: { set: "WordApiDesktop", version: "1.3" },
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "The style name, as listed by word_list_styles." },
      type: { type: "string", enum: [...TYPES], description: "Required when the style does not exist yet." },
      font: { type: "object", properties: fontProperties, additionalProperties: false },
      paragraph: {
        type: "object",
        properties: {
          ...paragraphProperties,
          keepWithNext: { type: "boolean" },
          keepTogether: { type: "boolean", description: "Keep the lines of a paragraph on one page." },
        },
        additionalProperties: false,
      },
      baseStyle: { type: "string" },
      nextStyle: { type: "string", description: "The style of a new paragraph after one with this style." },
    },
    required: ["name"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const name = requireString(args, "name");
    const type = optionalOneOf(args, "type", TYPES);
    const fontArgs = optionalObject(args, "font");
    const font = fontArgs ? readFont(fontArgs) : undefined;
    const paragraphArgs = optionalObject(args, "paragraph");
    const paragraph = paragraphArgs ? readParagraphFormat(paragraphArgs) : undefined;
    const keepWithNext = paragraphArgs ? optionalBoolean(paragraphArgs, "keepWithNext") : undefined;
    const keepTogether = paragraphArgs ? optionalBoolean(paragraphArgs, "keepTogether") : undefined;
    const baseStyle = optionalString(args, "baseStyle");
    const nextStyle = optionalString(args, "nextStyle");

    return runWord(signal, async (context) => {
      let style = context.document.getStyles().getByNameOrNullObject(name);
      style.load("isNullObject");
      await context.sync();
      // Word rejects a base or next style that does not exist with a bare InvalidArgument, so check them first.
      const referenced = [baseStyle, nextStyle].filter(
        (value): value is string => value !== undefined && value !== name
      );
      const lookups = referenced.map((styleName) => {
        const found = context.document.getStyles().getByNameOrNullObject(styleName);
        found.load("isNullObject");
        return { styleName, found };
      });
      await context.sync();
      const missing = lookups.filter((lookup) => lookup.found.isNullObject).map((lookup) => lookup.styleName);
      if (missing.length > 0) {
        throw new ToolArgumentError(
          `Style ${missing.map((styleName) => `"${styleName}"`).join(" and ")} does not exist. Create it before ` +
            "the style that names it as baseStyle or nextStyle, in an earlier call."
        );
      }
      const created = style.isNullObject;
      if (created) {
        if (!type) {
          throw new ToolArgumentError(`Style "${name}" does not exist. Give "type" to create it.`);
        }
        style = context.document.addStyle(name, type);
      }
      if (font) {
        applyFont(style.font, font);
      }
      if (paragraph) {
        applyStyleParagraphFormat(style, paragraph);
      }
      if (keepWithNext !== undefined) {
        style.paragraphFormat.keepWithNext = keepWithNext;
      }
      if (keepTogether !== undefined) {
        style.paragraphFormat.keepTogether = keepTogether;
      }
      if (baseStyle !== undefined) {
        style.baseStyle = baseStyle;
      }
      if (nextStyle !== undefined) {
        style.nextParagraphStyle = nextStyle;
      }
      style.load("nameLocal,type");
      await context.sync();
      return { name: style.nameLocal, type: style.type, created };
    });
  },
};
