import { optionalString, requireOneOf, requireString, ToolArgumentError } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { insertMarkdown, type InsertTarget } from "../markdownToWord";
import { markdownHint } from "./markdownHint";
import { CONTENT_LOCATIONS, runWord } from "./shared";

export const insertContent: OfficeToolDefinition = {
  name: "word_insert_content",
  description:
    "Insert Markdown content into the document: replacing the selection, before or after a paragraph " +
    "(paragraphId is required for those), or at the start or end of the document. A single Markdown paragraph " +
    `replaces the selection inside its paragraph. ${markdownHint}`,
  parameters: {
    type: "object",
    properties: {
      location: { type: "string", enum: [...CONTENT_LOCATIONS] },
      paragraphId: { type: "string", description: "Required when location is before or after." },
      markdown: { type: "string" },
    },
    required: ["location", "markdown"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const location = requireOneOf(args, "location", CONTENT_LOCATIONS);
    const paragraphId = optionalString(args, "paragraphId");
    const markdown = requireString(args, "markdown");
    if ((location === "before" || location === "after") && !paragraphId) {
      throw new ToolArgumentError(`"paragraphId" is required when location is "${location}".`);
    }

    return runWord(signal, async (context) => {
      let target: InsertTarget;
      switch (location) {
        case "replaceSelection":
          target = { kind: "selection", range: context.document.getSelection() };
          break;
        case "before":
        case "after":
          target = {
            kind: "paragraph",
            paragraph: context.document.getParagraphByUniqueLocalId(paragraphId as string),
            location: location === "before" ? "Before" : "After",
          };
          break;
        case "documentStart":
          target = { kind: "body", location: "Start" };
          break;
        case "documentEnd":
          target = { kind: "body", location: "End" };
          break;
      }
      const result = await insertMarkdown(context, target, markdown);
      return { insertedParagraphIds: result.paragraphIds, insertedTables: result.tables };
    });
  },
};
