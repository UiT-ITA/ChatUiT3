import { requireString } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import {
  applyStyleName,
  loadParagraphSpan,
  loadTargetRanges,
  readTarget,
  runWord,
  styleNameHint,
  targetHint,
  targetProperties,
} from "./shared";

export const setStyle: OfficeToolDefinition = {
  name: "word_set_style",
  description:
    "Apply a style. Without quote, a paragraph style goes on the paragraphs; with quote, a character style goes " +
    `on that text. ${styleNameHint} ${targetHint}`,
  parameters: {
    type: "object",
    properties: {
      ...targetProperties,
      style: { type: "string" },
    },
    required: ["fromId", "toId", "style"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const target = readTarget(args);
    const style = requireString(args, "style");

    return runWord(signal, async (context) => {
      if (target.quote === undefined) {
        const span = await loadParagraphSpan(context, target.fromId, target.toId);
        span.forEach((paragraph) => applyStyleName(paragraph, style));
        await context.sync();
        return { styledParagraphs: span.length, style };
      }
      const ranges = await loadTargetRanges(context, target);
      ranges.forEach((range) => applyStyleName(range, style));
      await context.sync();
      return { styledRanges: ranges.length, style };
    });
  },
};
