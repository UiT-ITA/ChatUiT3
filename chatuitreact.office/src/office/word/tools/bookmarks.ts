import { requireOneOf, requireString, ToolArgumentError } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { loadTargetRanges, readTarget, runWord, singleTargetProperties, targetHint } from "./shared";

const ACTIONS = ["add", "list", "delete"] as const;
/** Word's rule: a letter first, then letters, digits and underscores, at most 40 characters. */
const BOOKMARK_NAME = /^\p{L}[\p{L}\p{N}_]{0,39}$/u;

export const bookmarks: OfficeToolDefinition = {
  name: "word_bookmarks",
  description:
    "add: put a bookmark named name on a target (the first occurrence of quote). list: every bookmark with the id " +
    "of its first paragraph and its text. delete: remove the bookmark name. Link to a bookmark with " +
    `word_format_text hyperlink #name or a Ref field. ${targetHint}`,
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: [...ACTIONS] },
      ...singleTargetProperties,
      name: { type: "string", description: "A letter first, then letters, digits or underscores; at most 40." },
    },
    required: ["action"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const action = requireOneOf(args, "action", ACTIONS);
    switch (action) {
      case "add": {
        const target = readTarget(args);
        const name = requireString(args, "name");
        if (!BOOKMARK_NAME.test(name)) {
          throw new ToolArgumentError(
            `"name" must start with a letter and have only letters, digits and underscores, at most 40 characters.`
          );
        }
        return runWord(signal, async (context) => {
          const [range] = await loadTargetRanges(context, target);
          range.insertBookmark(name);
          await context.sync();
          return { name };
        });
      }
      case "list":
        return runWord(signal, async (context) => {
          const names = context.document.body.getRange("Whole").getBookmarks(false, false);
          await context.sync();
          const ranges = names.value.map((name) => {
            const range = context.document.getBookmarkRange(name);
            range.load("text");
            return { range, paragraph: range.paragraphs.getFirst().load("uniqueLocalId") };
          });
          await context.sync();
          return {
            bookmarks: names.value.map((name, index) => ({
              name,
              paragraphId: ranges[index].paragraph.uniqueLocalId,
              text: ranges[index].range.text,
            })),
          };
        });
      case "delete": {
        const name = requireString(args, "name");
        return runWord(signal, async (context) => {
          context.document.deleteBookmark(name);
          await context.sync();
          return { deleted: name };
        });
      }
    }
  },
};
