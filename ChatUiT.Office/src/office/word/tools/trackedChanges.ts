import { optionalInteger, requireOneOf, ToolArgumentError } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { runWord } from "./shared";

const ACTIONS = ["list", "accept", "reject", "acceptAll", "rejectAll"] as const;
const MAX_TEXT = 200;

export const trackedChanges: OfficeToolDefinition = {
  name: "word_tracked_changes",
  description:
    "list: the tracked changes in the document body with their index, type, author, date, text and paragraph id. " +
    "accept or reject: the change at index from list. acceptAll or rejectAll: every change. Indexes change after " +
    "accept or reject, so list again before the next one.",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: [...ACTIONS] },
      index: { type: "integer", minimum: 0, description: "For accept and reject." },
    },
    required: ["action"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const action = requireOneOf(args, "action", ACTIONS);
    const index = optionalInteger(args, "index");
    if ((action === "accept" || action === "reject") && (index === undefined || index < 0)) {
      throw new ToolArgumentError(`"index" is required for ${action}.`);
    }

    return runWord(signal, async (context) => {
      const changes = context.document.body.getTrackedChanges();
      if (action === "acceptAll" || action === "rejectAll") {
        changes.load("items");
        await context.sync();
        if (action === "acceptAll") {
          changes.acceptAll();
        } else {
          changes.rejectAll();
        }
        await context.sync();
        return { changes: changes.items.length, done: action };
      }

      changes.load("items/type,items/author,items/date,items/text");
      await context.sync();
      if (action === "list") {
        const paragraphs = changes.items.map((change) => change.getRange().paragraphs.getFirst().load("uniqueLocalId"));
        await context.sync();
        return {
          trackedChanges: changes.items.map((change, position) => ({
            index: position,
            type: change.type,
            author: change.author,
            date: change.date,
            text: change.text.length > MAX_TEXT ? `${change.text.slice(0, MAX_TEXT)}…` : change.text,
            paragraphId: paragraphs[position].uniqueLocalId,
          })),
        };
      }
      const change = changes.items[index as number];
      if (!change) {
        throw new Error(`There is no tracked change at index ${index}. The document has ${changes.items.length}.`);
      }
      if (action === "accept") {
        change.accept();
      } else {
        change.reject();
      }
      await context.sync();
      return { index, done: action, type: change.type, text: change.text };
    });
  },
};
