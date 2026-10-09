/* global OfficeExtension, Word */

import { requireOneOf } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { toFlatPackage } from "../ooxml";
import {
  describeWordError,
  loadParagraphSpan,
  loadTargetRanges,
  readTarget,
  runWord,
  targetHint,
  targetProperties,
} from "./shared";

const BREAKS = {
  page: "Page",
  column: null,
  line: "Line",
  sectionNextPage: "SectionNext",
  sectionContinuous: "SectionContinuous",
  sectionEvenPage: "SectionEven",
  sectionOddPage: "SectionOdd",
} as const;
const TYPES = Object.keys(BREAKS) as Array<keyof typeof BREAKS>;
const POSITIONS = ["before", "after"] as const;

/** Breaks as OOXML: Word's API has no column break, and the others are the fallback when insertBreak fails. */
const OOXML_BREAKS: Partial<Record<keyof typeof BREAKS, string>> = {
  page: toFlatPackage('<w:r><w:br w:type="page"/></w:r>'),
  column: toFlatPackage('<w:r><w:br w:type="column"/></w:r>'),
  line: toFlatPackage("<w:r><w:br/></w:r>"),
};

export const insertBreak: OfficeToolDefinition = {
  name: "word_insert_break",
  description:
    "Insert a page, column, line or section break before or after a target: before the first or after the last " +
    "paragraph, or before or after the quote. A section break starts the new section on the next page, on the " +
    `same page (continuous), or on the next even or odd page. ${targetHint}`,
  parameters: {
    type: "object",
    properties: {
      ...targetProperties,
      type: { type: "string", enum: TYPES },
      position: { type: "string", enum: [...POSITIONS] },
    },
    required: ["fromId", "toId", "type", "position"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const target = readTarget(args);
    const type = requireOneOf(args, "type", TYPES);
    const position = requireOneOf(args, "position", POSITIONS) === "before" ? "Before" : "After";

    return runWord(signal, async (context) => {
      let anchors: Array<Word.Paragraph | Word.Range>;
      if (target.quote !== undefined) {
        anchors = await loadTargetRanges(context, target);
      } else {
        const span = await loadParagraphSpan(context, target.fromId, target.toId);
        const paragraph = position === "Before" ? span[0] : span[span.length - 1];
        paragraph.load("tableNestingLevel");
        await context.sync();
        // Word refuses breaks inside table cells, so a break next to a table paragraph goes next to the table.
        anchors = [paragraph.tableNestingLevel > 0 ? paragraph.parentTable.getRange("Whole") : paragraph];
      }
      for (const anchor of anchors) {
        await insertWithFallback(context, anchor, type, position);
      }
      return { insertedBreaks: anchors.length };
    });
  },
};

/**
 * Inserts the break with Word's API and, when the host rejects it, as OOXML. Each attempt is synced on its own;
 * when every attempt fails the error lists what Word said for each.
 */
async function insertWithFallback(
  context: Word.RequestContext,
  anchor: Word.Paragraph | Word.Range,
  type: keyof typeof BREAKS,
  position: "Before" | "After"
): Promise<void> {
  const breakType = BREAKS[type];
  const ooxml = OOXML_BREAKS[type];
  const attempts: Array<[string, () => void]> = [];
  if (breakType) {
    attempts.push(["insertBreak", () => anchor.insertBreak(breakType, position)]);
  }
  if (ooxml) {
    const point = anchor instanceof Word.Paragraph ? anchor.getRange("Content") : anchor;
    attempts.push(["OOXML", () => point.insertOoxml(ooxml, position)]);
  }
  const errors: string[] = [];
  for (const [name, attempt] of attempts) {
    try {
      attempt();
      // eslint-disable-next-line office-addins/no-context-sync-in-loop
      await context.sync();
      return;
    } catch (error) {
      errors.push(`${name}: ${error instanceof OfficeExtension.Error ? describeWordError(error) : String(error)}`);
    }
  }
  throw new Error(`Word rejected the ${type} break. ${errors.join(" | ")}`);
}
