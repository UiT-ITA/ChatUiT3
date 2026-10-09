import { requireString } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { insertMarkdown } from "../markdownToWord";
import { markdownHint } from "./markdownHint";
import { loadParagraphSpan, runWord } from "./shared";

export const replaceParagraphs: OfficeToolDefinition = {
  name: "word_replace_paragraphs",
  description:
    "Replace the paragraphs from fromId to toId (inclusive; use the same id for one paragraph) with Markdown content. " +
    `${markdownHint}`,
  parameters: {
    type: "object",
    properties: {
      fromId: { type: "string" },
      toId: { type: "string" },
      markdown: { type: "string" },
    },
    required: ["fromId", "toId", "markdown"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const fromId = requireString(args, "fromId");
    const toId = requireString(args, "toId");
    const markdown = requireString(args, "markdown");

    return runWord(signal, async (context) => {
      const span = await loadParagraphSpan(context, fromId, toId);
      const result = await insertMarkdown(
        context,
        { kind: "paragraph", paragraph: span[0], location: "Before" },
        markdown
      );
      span.forEach((paragraph) => paragraph.delete());
      await context.sync();
      return {
        deletedParagraphs: span.length,
        insertedParagraphIds: result.paragraphIds,
        insertedTables: result.tables,
      };
    });
  },
};
