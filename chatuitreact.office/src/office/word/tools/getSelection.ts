import type { OfficeToolDefinition } from "../../shared/officeTool";
import { runWord } from "./shared";

export const getSelection: OfficeToolDefinition = {
  name: "word_get_selection",
  description: "Get the text the user has selected in Word and the ids of the paragraphs it touches.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  handler: (_args, signal) =>
    runWord(signal, async (context) => {
      const range = context.document.getSelection();
      range.load("text");
      const paragraphs = context.document.getSelection().paragraphs;
      paragraphs.load("items/uniqueLocalId");
      await context.sync();
      return {
        text: range.text,
        paragraphIds: paragraphs.items.map((paragraph) => paragraph.uniqueLocalId),
      };
    }),
};
