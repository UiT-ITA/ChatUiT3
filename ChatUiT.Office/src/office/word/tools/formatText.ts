import { optionalString, ToolArgumentError } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { applyFont, fontProperties, isEmptyFont, readFont } from "./formatting";
import { loadTargetRanges, readTarget, runWord, targetHint, targetProperties } from "./shared";

export const formatText: OfficeToolDefinition = {
  name: "word_format_text",
  description:
    "Set font formatting on a target, and optionally a hyperlink (a URL, or #name for a bookmark in the document). " +
    `Only the given properties change. ${targetHint}`,
  requires: { set: "WordApiDesktop", version: "1.3" },
  parameters: {
    type: "object",
    properties: {
      ...targetProperties,
      ...fontProperties,
      hyperlink: { type: "string", description: "A URL, or #name for a bookmark." },
    },
    required: ["fromId", "toId"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const target = readTarget(args);
    const font = readFont(args);
    const hyperlink = optionalString(args, "hyperlink");
    if (isEmptyFont(font) && hyperlink === undefined) {
      throw new ToolArgumentError("Give at least one font property or hyperlink.");
    }

    return runWord(signal, async (context) => {
      const ranges = await loadTargetRanges(context, target);
      for (const range of ranges) {
        applyFont(range.font, font);
        if (hyperlink !== undefined) {
          range.hyperlink = hyperlink;
        }
      }
      await context.sync();
      return { formattedRanges: ranges.length };
    });
  },
};
