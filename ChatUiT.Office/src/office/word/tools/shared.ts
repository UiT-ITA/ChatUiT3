/* global AbortSignal, OfficeExtension, Word */

import {
  optionalBoolean,
  optionalString,
  requireOneOf,
  requireString,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { ToolArguments } from "../../../chat/tools/types";
import { describeOfficeError, type ErrorHints } from "../../shared/officeError";
import { runBatch } from "../../shared/runBatch";

/** What Word's error codes mean for the paragraph ids the tools use. */
const wordHints: ErrorHints = {
  ItemNotFound:
    "a paragraph id may be stale; ids change when the document is reopened, so get current ids with " +
    "word_get_overview, word_read_paragraphs or word_search",
};

/** Runs a Word batch unless the call was cancelled. Office errors are rethrown with Word's debug info. */
export function runWord<T>(signal: AbortSignal, batch: (context: Word.RequestContext) => Promise<T>): Promise<T> {
  return runBatch(signal, () => Word.run(batch), wordHints);
}

export function describeWordError(error: OfficeExtension.Error): string {
  return describeOfficeError(error, wordHints);
}

/** Loads the paragraphs from `fromId` to `toId`, inclusive and in document order. */
export async function loadParagraphSpan(
  context: Word.RequestContext,
  fromId: string,
  toId: string
): Promise<Word.Paragraph[]> {
  const from = context.document.getParagraphByUniqueLocalId(fromId);
  const to = context.document.getParagraphByUniqueLocalId(toId);
  const paragraphs = from.getRange("Whole").expandTo(to.getRange("Whole")).paragraphs;
  paragraphs.load("items/uniqueLocalId");
  await context.sync();

  const ids = paragraphs.items.map((paragraph) => paragraph.uniqueLocalId);
  const start = ids.indexOf(fromId);
  const end = ids.indexOf(toId);
  if (start < 0 || end < 0) {
    throw new Error("Could not resolve the paragraph range from fromId to toId.");
  }
  return paragraphs.items.slice(Math.min(start, end), Math.max(start, end) + 1);
}

export function headingLevel(style: string): number | null {
  const match = /^Heading([1-9])$/.exec(style);
  return match ? Number(match[1]) : null;
}

export const MAX_QUOTE_LENGTH = 255;

/** A paragraph span, or exact text inside it, as the arguments of a tool. */
export const singleTargetProperties = {
  fromId: { type: "string" },
  toId: { type: "string" },
  quote: {
    type: "string",
    maxLength: MAX_QUOTE_LENGTH,
    description:
      "Exact text (case-sensitive) inside the paragraphs. Targets that text instead of the whole paragraphs.",
  },
};

/** `singleTargetProperties` plus `allOccurrences`. */
export const targetProperties = {
  ...singleTargetProperties,
  allOccurrences: {
    type: "boolean",
    description: "With quote: every occurrence in the paragraphs, not only the first.",
  },
};

export const targetHint =
  "The target is the paragraphs from fromId to toId (inclusive; use the same id for one paragraph), or `quote` inside them.";

export interface Target {
  fromId: string;
  toId: string;
  quote?: string;
  allOccurrences: boolean;
}

export function readTarget(args: ToolArguments): Target {
  const quote = optionalString(args, "quote");
  if (quote !== undefined && (quote.length === 0 || quote.length > MAX_QUOTE_LENGTH)) {
    throw new ToolArgumentError(`"quote" must be 1 to ${MAX_QUOTE_LENGTH} characters.`);
  }
  return {
    fromId: requireString(args, "fromId"),
    toId: requireString(args, "toId"),
    quote,
    allOccurrences: optionalBoolean(args, "allOccurrences") ?? false,
  };
}

/**
 * The ranges of a target: the content of the paragraph span, or the first (or every) occurrence of
 * the quote inside it.
 */
export async function loadTargetRanges(context: Word.RequestContext, target: Target): Promise<Word.Range[]> {
  const span = await loadParagraphSpan(context, target.fromId, target.toId);
  const range = span[0].getRange("Content").expandTo(span[span.length - 1].getRange("Content"));
  if (target.quote === undefined) {
    return [range];
  }
  const found = range.search(target.quote, { matchCase: true });
  found.load("items");
  await context.sync();
  if (found.items.length === 0) {
    throw new Error("The quote was not found in the paragraphs.");
  }
  return target.allOccurrences ? found.items : found.items.slice(0, 1);
}

/** The locations of word_insert_content. */
export const CONTENT_LOCATIONS = ["replaceSelection", "before", "after", "documentStart", "documentEnd"] as const;
/** The locations of word_insert_content plus replace of a paragraph span. */
export const INSERT_LOCATIONS = [...CONTENT_LOCATIONS, "replace"] as const;

export const locationProperties = {
  location: { type: "string", enum: [...INSERT_LOCATIONS] },
  paragraphId: { type: "string", description: "Required when location is before or after." },
  fromId: { type: "string", description: "Required when location is replace: the first paragraph to replace." },
  toId: { type: "string", description: "Required when location is replace: the last paragraph to replace." },
};

export type InsertLocation =
  | { location: "replaceSelection" | "documentStart" | "documentEnd" }
  | { location: "before" | "after"; paragraphId: string }
  | { location: "replace"; fromId: string; toId: string };

export function readInsertLocation(args: ToolArguments): InsertLocation {
  const location = requireOneOf(args, "location", INSERT_LOCATIONS);
  switch (location) {
    case "before":
    case "after":
      if (!optionalString(args, "paragraphId")) {
        throw new ToolArgumentError(`"paragraphId" is required when location is "${location}".`);
      }
      return { location, paragraphId: requireString(args, "paragraphId") };
    case "replace":
      return { location, fromId: requireString(args, "fromId"), toId: requireString(args, "toId") };
    default:
      return { location };
  }
}

/** Where block content goes: at the start or end of the body, or before or after a paragraph. */
export type BlockAnchor =
  { body: Word.Body; location: "Start" | "End" } | { paragraph: Word.Paragraph; location: "Before" | "After" };

export interface BlockLocation {
  anchor: BlockAnchor;
  /** What the content replaces. Delete it with `deleteReplaced` after inserting. */
  replaced: Array<Word.Paragraph | Word.Range>;
}

/** Resolves a location for block content. The selection is replaced by content after its last paragraph. */
export async function resolveBlockLocation(
  context: Word.RequestContext,
  target: InsertLocation
): Promise<BlockLocation> {
  const body = context.document.body;
  switch (target.location) {
    case "replaceSelection": {
      const selection = context.document.getSelection();
      return { anchor: { paragraph: selection.paragraphs.getLast(), location: "After" }, replaced: [selection] };
    }
    case "before":
    case "after":
      return {
        anchor: {
          paragraph: context.document.getParagraphByUniqueLocalId(target.paragraphId),
          location: target.location === "before" ? "Before" : "After",
        },
        replaced: [],
      };
    case "documentStart":
      return { anchor: { body, location: "Start" }, replaced: [] };
    case "documentEnd":
      return { anchor: { body, location: "End" }, replaced: [] };
    case "replace": {
      const span = await loadParagraphSpan(context, target.fromId, target.toId);
      return { anchor: { paragraph: span[0], location: "Before" }, replaced: span };
    }
  }
}

export function deleteReplaced(location: BlockLocation): void {
  location.replaced.forEach((item) => item.delete());
}

/**
 * Inserts inline content with `insert`, which fills the empty range it gets with "Replace": the
 * selection, or a new empty Normal paragraph at the location. For replace, the new paragraph goes
 * before the span and the span is deleted afterwards.
 */
export async function insertAtLocation<T>(
  context: Word.RequestContext,
  target: InsertLocation,
  insert: (range: Word.Range) => T
): Promise<T> {
  if (target.location === "replaceSelection") {
    const result = insert(context.document.getSelection());
    await context.sync();
    return result;
  }
  const block = await resolveBlockLocation(context, target);
  const { anchor } = block;
  const paragraph =
    "body" in anchor
      ? anchor.body.insertParagraph("", anchor.location)
      : anchor.paragraph.insertParagraph("", anchor.location);
  paragraph.styleBuiltIn = Word.BuiltInStyleName.normal;
  paragraph.load("isListItem");
  await context.sync();
  // A paragraph inserted next to a list item joins that list.
  if (paragraph.isListItem) {
    paragraph.detachFromList();
  }
  const result = insert(paragraph.getRange("Content"));
  deleteReplaced(block);
  await context.sync();
  return result;
}

/** Built-in style names (values of Word.BuiltInStyleName), which are portable between locales. */
export function isBuiltInStyleName(name: string): name is Word.BuiltInStyleName {
  return name !== Word.BuiltInStyleName.other && (Object.values(Word.BuiltInStyleName) as string[]).includes(name);
}

/** Applies a style by name: built-in names set `styleBuiltIn`, other names set `style`. */
export function applyStyleName(target: { style: string; styleBuiltIn: Word.BuiltInStyleName | string }, name: string) {
  if (isBuiltInStyleName(name)) {
    target.styleBuiltIn = name;
  } else {
    target.style = name;
  }
}

export const styleNameHint =
  "Built-in names such as Heading1, Title, Quote or GridTable4_Accent1 work in every language; " +
  "other names are the document's own style names from word_list_styles.";
