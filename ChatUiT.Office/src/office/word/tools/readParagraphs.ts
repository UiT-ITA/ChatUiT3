/* global Word */

import { optionalBoolean, optionalString, optionalInteger, ToolArgumentError } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { runWord } from "./shared";

const MAX_COUNT = 50;

export const readParagraphs: OfficeToolDefinition = {
  name: "word_read_paragraphs",
  description:
    "Read paragraphs in document order: id, text, style, whether it is a list item and whether it is in a table. " +
    "Starts at the beginning of the document, or right after the paragraph `afterId`. Page with `nextAfterId`. " +
    "With includeFormatting, also alignment, indents, spacing and line spacing (points), list level, and the " +
    "paragraph font (name, size, bold, italic, color; null when mixed).",
  parameters: {
    type: "object",
    properties: {
      afterId: { type: "string", description: "Read the paragraphs after this paragraph id." },
      count: { type: "integer", minimum: 1, maximum: MAX_COUNT, description: "How many paragraphs to read." },
      includeFormatting: { type: "boolean" },
    },
    required: ["count"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const afterId = optionalString(args, "afterId");
    const count = optionalInteger(args, "count");
    if (count === undefined || count < 1 || count > MAX_COUNT) {
      throw new ToolArgumentError(`"count" must be an integer from 1 to ${MAX_COUNT}.`);
    }
    const includeFormatting = optionalBoolean(args, "includeFormatting") ?? false;
    return runWord(signal, async (context) => {
      const paragraphs = context.document.body.paragraphs;
      paragraphs.load("items/uniqueLocalId");
      await context.sync();

      let start = 0;
      if (afterId) {
        const index = paragraphs.items.findIndex((paragraph) => paragraph.uniqueLocalId === afterId);
        if (index < 0) {
          throw new Error(`Paragraph "${afterId}" was not found.`);
        }
        start = index + 1;
      }
      const slice = paragraphs.items.slice(start, start + count);
      slice.forEach((paragraph) => {
        paragraph.load("text,style,isListItem,tableNestingLevel");
        if (includeFormatting) {
          paragraph.load("alignment,leftIndent,rightIndent,firstLineIndent,spaceBefore,spaceAfter,lineSpacing");
          paragraph.font.load("name,size,bold,italic,color");
          paragraph.listItemOrNullObject.load("level");
        }
      });
      await context.sync();

      const end = start + slice.length;
      return {
        totalParagraphs: paragraphs.items.length,
        paragraphs: slice.map((paragraph) => ({
          id: paragraph.uniqueLocalId,
          text: paragraph.text,
          style: paragraph.style,
          isListItem: paragraph.isListItem,
          isInTable: paragraph.tableNestingLevel > 0,
          ...(includeFormatting ? { formatting: formattingOf(paragraph) } : {}),
        })),
        nextAfterId: end < paragraphs.items.length ? (slice[slice.length - 1]?.uniqueLocalId ?? null) : null,
      };
    });
  },
};

function formattingOf(paragraph: Word.Paragraph) {
  const { font } = paragraph;
  const listItem = paragraph.listItemOrNullObject;
  return {
    alignment: paragraph.alignment,
    leftIndent: paragraph.leftIndent,
    rightIndent: paragraph.rightIndent,
    firstLineIndent: paragraph.firstLineIndent,
    spaceBefore: paragraph.spaceBefore,
    spaceAfter: paragraph.spaceAfter,
    lineSpacing: paragraph.lineSpacing,
    listLevel: listItem.isNullObject ? null : listItem.level,
    // Word reports mixed values as null or an empty string.
    font: {
      name: font.name || null,
      size: font.size ?? null,
      bold: font.bold ?? null,
      italic: font.italic ?? null,
      color: font.color || null,
    },
  };
}
