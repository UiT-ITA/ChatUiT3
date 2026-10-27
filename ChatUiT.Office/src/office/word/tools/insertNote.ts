import { requireOneOf, requireString } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { loadTargetRanges, readTarget, runWord, targetHint, targetProperties } from "./shared";

const TYPES = ["footnote", "endnote"] as const;

export const insertNote: OfficeToolDefinition = {
  name: "word_insert_note",
  description:
    "Insert a footnote or endnote with plain text. The note reference goes right after the target, usually a " +
    `quote. ${targetHint}`,
  parameters: {
    type: "object",
    properties: {
      ...targetProperties,
      type: { type: "string", enum: [...TYPES] },
      text: { type: "string" },
    },
    required: ["fromId", "toId", "type", "text"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const target = readTarget(args);
    const type = requireOneOf(args, "type", TYPES);
    const text = requireString(args, "text");

    return runWord(signal, async (context) => {
      const ranges = await loadTargetRanges(context, target);
      ranges.forEach((range) => (type === "footnote" ? range.insertFootnote(text) : range.insertEndnote(text)));
      await context.sync();
      return { insertedNotes: ranges.length, type };
    });
  },
};
