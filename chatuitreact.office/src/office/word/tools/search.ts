import { optionalBoolean, requireString, ToolArgumentError } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { runWord } from "./shared";

const MAX_MATCHES = 50;
const MAX_QUERY_LENGTH = 255;
const SNIPPET_CONTEXT = 60;

export const search: OfficeToolDefinition = {
  name: "word_search",
  description:
    "Search the document for text. Returns the id of the paragraph of each match and a snippet around it " +
    `(at most ${MAX_MATCHES} matches).`,
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", maxLength: MAX_QUERY_LENGTH },
      matchCase: { type: "boolean" },
      matchWholeWord: { type: "boolean" },
    },
    required: ["query"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const query = requireString(args, "query");
    if (query.length > MAX_QUERY_LENGTH) {
      throw new ToolArgumentError(`"query" can be at most ${MAX_QUERY_LENGTH} characters.`);
    }
    const matchCase = optionalBoolean(args, "matchCase") ?? false;
    const matchWholeWord = optionalBoolean(args, "matchWholeWord") ?? false;

    return runWord(signal, async (context) => {
      const ranges = context.document.body.search(query, { matchCase, matchWholeWord });
      ranges.load("items/text");
      await context.sync();

      const found = ranges.items.slice(0, MAX_MATCHES);
      const paragraphs = found.map((range) => {
        const paragraph = range.paragraphs.getFirst();
        paragraph.load("uniqueLocalId,text");
        return paragraph;
      });
      await context.sync();

      return {
        totalMatches: ranges.items.length,
        matches: found.map((range, index) => ({
          paragraphId: paragraphs[index].uniqueLocalId,
          snippet: snippet(paragraphs[index].text, range.text, matchCase),
        })),
      };
    });
  },
};

function snippet(text: string, match: string, matchCase: boolean): string {
  const at = matchCase ? text.indexOf(match) : text.toLowerCase().indexOf(match.toLowerCase());
  if (at < 0) {
    return text.slice(0, SNIPPET_CONTEXT * 2);
  }
  const start = Math.max(0, at - SNIPPET_CONTEXT);
  const end = Math.min(text.length, at + match.length + SNIPPET_CONTEXT);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
