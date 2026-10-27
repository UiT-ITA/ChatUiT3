import { requireString, ToolArgumentError } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { applyParagraphFormat, isEmptyParagraphFormat, paragraphProperties, readParagraphFormat } from "./formatting";
import { loadParagraphSpan, runWord } from "./shared";

export const formatParagraphs: OfficeToolDefinition = {
  name: "word_format_paragraphs",
  description:
    "Set paragraph formatting on the paragraphs from fromId to toId (inclusive; use the same id for one paragraph). " +
    `Only the given properties change.`,
  requires: { set: "WordApiDesktop", version: "1.3" },
  parameters: {
    type: "object",
    properties: {
      fromId: { type: "string" },
      toId: { type: "string" },
      ...paragraphProperties,
    },
    required: ["fromId", "toId"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const fromId = requireString(args, "fromId");
    const toId = requireString(args, "toId");
    const format = readParagraphFormat(args);
    if (isEmptyParagraphFormat(format)) {
      throw new ToolArgumentError("Give at least one paragraph property.");
    }

    return runWord(signal, async (context) => {
      const span = await loadParagraphSpan(context, fromId, toId);
      if (format.border) {
        span.forEach((paragraph) => paragraph.borders.load("items"));
        await context.sync();
      }
      span.forEach((paragraph) => applyParagraphFormat(paragraph, format));
      await context.sync();
      return { formattedParagraphs: span.length };
    });
  },
};
