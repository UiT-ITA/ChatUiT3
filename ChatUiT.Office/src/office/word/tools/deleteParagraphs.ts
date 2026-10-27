import { requireString } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { loadParagraphSpan, runWord } from "./shared";

export const deleteParagraphs: OfficeToolDefinition = {
  name: "word_delete_paragraphs",
  description: "Delete the paragraphs from fromId to toId (inclusive; use the same id for one paragraph).",
  parameters: {
    type: "object",
    properties: {
      fromId: { type: "string" },
      toId: { type: "string" },
    },
    required: ["fromId", "toId"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const fromId = requireString(args, "fromId");
    const toId = requireString(args, "toId");

    return runWord(signal, async (context) => {
      const span = await loadParagraphSpan(context, fromId, toId);
      span.forEach((paragraph) => paragraph.delete());
      await context.sync();
      return { deletedParagraphs: span.length };
    });
  },
};
