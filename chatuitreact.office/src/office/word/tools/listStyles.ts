import { optionalBoolean, optionalOneOf } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { runWord } from "./shared";

const TYPES = ["Paragraph", "Character", "Table", "List"] as const;

export const listStyles: OfficeToolDefinition = {
  name: "word_list_styles",
  description:
    "List the styles in the document: name (as used by word_set_style), type, whether it is built in, whether it " +
    "is in use, and its base style. Filter by type and by in use.",
  parameters: {
    type: "object",
    properties: {
      type: { type: "string", enum: [...TYPES] },
      inUse: { type: "boolean", description: "Only styles that are in use (true) or not in use (false)." },
    },
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const type = optionalOneOf(args, "type", TYPES);
    const inUse = optionalBoolean(args, "inUse");

    return runWord(signal, async (context) => {
      const styles = context.document.getStyles();
      styles.load("items/nameLocal,items/type,items/builtIn,items/inUse,items/baseStyle");
      await context.sync();
      return {
        styles: styles.items
          .filter(
            (style) => (type === undefined || style.type === type) && (inUse === undefined || style.inUse === inUse)
          )
          .map((style) => ({
            name: style.nameLocal,
            type: style.type,
            builtIn: style.builtIn,
            inUse: style.inUse,
            baseStyle: style.baseStyle || null,
          })),
      };
    });
  },
};
