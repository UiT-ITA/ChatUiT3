import { optionalBoolean, optionalString, requireString, ToolArgumentError } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { replaceTextWithDiff } from "../paragraphDiff";
import { runWord } from "./shared";

const MAX_SEARCH_LENGTH = 255;

export const replaceText: OfficeToolDefinition = {
  name: "word_replace_text",
  description:
    "Replace exact text (case-sensitive) with plain replacement text, in one paragraph or in the whole document. " +
    `Replaces the first match, or every match when all is true. Only the words that differ are changed.`,
  parameters: {
    type: "object",
    properties: {
      search: { type: "string", maxLength: MAX_SEARCH_LENGTH },
      replacement: { type: "string" },
      paragraphId: { type: "string", description: "Limit the replacement to this paragraph." },
      all: { type: "boolean", description: "Replace every match instead of the first." },
    },
    required: ["search", "replacement"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const searchText = requireString(args, "search");
    if (searchText.length > MAX_SEARCH_LENGTH) {
      throw new ToolArgumentError(`"search" can be at most ${MAX_SEARCH_LENGTH} characters.`);
    }
    const replacement = args.replacement;
    if (typeof replacement !== "string") {
      throw new ToolArgumentError(`"replacement" must be a string.`);
    }
    const paragraphId = optionalString(args, "paragraphId");
    const all = optionalBoolean(args, "all") ?? false;

    return runWord(signal, async (context) => {
      const scope = paragraphId ? context.document.getParagraphByUniqueLocalId(paragraphId) : context.document.body;
      const ranges = scope.search(searchText, { matchCase: true });
      ranges.load("items/text");
      await context.sync();

      const targets = all ? ranges.items : ranges.items.slice(0, 1);
      await replaceTextWithDiff(context, targets, searchText, replacement);
      return { found: ranges.items.length, replaced: targets.length };
    });
  },
};
