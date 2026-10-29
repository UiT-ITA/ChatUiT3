/* global Word */

import {
  blockText,
  CODE_FONT,
  type Block,
  type ParagraphBlock,
  type Run,
  type RunFormat,
  writeBlocks,
} from "./markdownToWord";
import { diffText, longestCommonPairs, similarity, tokenize, type TextChange } from "./wordDiff";

/**
 * Replaces paragraphs with new blocks by changing only what differs. An old and a new paragraph
 * that share at least half their words are a pair: the pair's changed words are replaced, its
 * formatting and style are set where they differ, and the rest of the paragraph is not touched.
 * Old paragraphs without a pair are deleted and new ones without a pair are inserted. Tables, in
 * the old paragraphs or the new blocks, replace everything.
 */

export interface ReplaceResult {
  paragraphIds: string[];
  editedParagraphs: number;
  insertedParagraphs: number;
  deletedParagraphs: number;
  insertedTables: number;
}

const MIN_SIMILARITY = 0.5;
/** Word searches at most 255 characters. */
const MAX_SEARCH = 255;
/** The built-in styles Markdown writes, besides Normal. */
const MARKDOWN_STYLES = new Set<string>([...Array.from({ length: 9 }, (_, index) => `Heading${index + 1}`), "Quote"]);

interface OldParagraph {
  paragraph: Word.Paragraph;
  id: string;
  text: string;
  styleBuiltIn: string;
  list: { ordered: boolean; level: number } | null;
  style: Word.Style;
}

interface FontState {
  bold: boolean | null;
  italic: boolean | null;
  strike: boolean | null;
  name: string;
  hyperlink: string;
}

/** A range of old text found with Word's search. */
class Located {
  font: FontState | null = null;
  constructor(public readonly range: Word.Range) {}
}

interface Segment {
  text: string;
  format: RunFormat;
}

interface ChangeEdit {
  change: TextChange;
  /** The old text, or for an insertion the text next to it. */
  target: Located | null;
  location: "Replace" | "After" | "Before" | "Start";
  segments: Segment[];
}

interface FormatEdit {
  target: Located;
  format: RunFormat;
}

interface Pair {
  old: OldParagraph;
  block: ParagraphBlock;
  changes: ChangeEdit[];
  formats: FormatEdit[];
}

export async function replaceWithDiff(
  context: Word.RequestContext,
  span: Word.Paragraph[],
  blocks: Block[]
): Promise<ReplaceResult> {
  const olds = await loadOld(context, span);
  const paragraphs = blocks.filter((block): block is ParagraphBlock => block.kind === "paragraph");
  if (olds === null || paragraphs.length < blocks.length) {
    return replaceAll(context, span, blocks);
  }

  const planned = longestCommonPairs(olds, paragraphs, isPair).flatMap(([oldIndex, newIndex]) => {
    const plan = planPair(olds[oldIndex], paragraphs[newIndex]);
    return plan ? [{ oldIndex, newIndex, ...plan }] : [];
  });
  await context.sync();

  // A pair whose text Word does not find as expected is replaced whole.
  const pairs = new Map<number, { newIndex: number; pair: Pair }>();
  const located: Located[] = [];
  for (const { oldIndex, newIndex, pair, searches } of planned) {
    const found = searches.map((resolve) => resolve());
    if (found.every((target) => target !== null)) {
      pairs.set(oldIndex, { newIndex, pair });
      located.push(...(found as Located[]));
    }
  }
  for (const target of located) {
    target.range.font.load("bold,italic,strikeThrough,name");
    target.range.load("hyperlink");
  }
  await context.sync();
  for (const target of located) {
    const { font } = target.range;
    target.font = {
      bold: font.bold ?? null,
      italic: font.italic ?? null,
      strike: font.strikeThrough ?? null,
      name: font.name ?? "",
      hyperlink: target.range.hyperlink ?? "",
    };
  }

  const result: ReplaceResult = {
    paragraphIds: [],
    editedParagraphs: 0,
    insertedParagraphs: 0,
    deletedParagraphs: 0,
    insertedTables: 0,
  };
  const deleted: OldParagraph[] = [];
  let newIndex = 0;
  const insertGap = async (to: number, oldIndex: number) => {
    const gap = paragraphs.slice(newIndex, to);
    newIndex = to;
    if (gap.length === 0) {
      return;
    }
    const target =
      oldIndex < olds.length
        ? { kind: "paragraph" as const, paragraph: olds[oldIndex].paragraph, location: "Before" as const }
        : { kind: "paragraph" as const, paragraph: olds[olds.length - 1].paragraph, location: "After" as const };
    const inserted = await writeBlocks(context, target, gap);
    result.paragraphIds.push(...inserted.paragraphIds);
    result.insertedParagraphs += inserted.paragraphIds.length;
  };
  for (let oldIndex = 0; oldIndex < olds.length; oldIndex++) {
    const entry = pairs.get(oldIndex);
    if (!entry) {
      deleted.push(olds[oldIndex]);
      continue;
    }
    const { pair } = entry;
    await insertGap(entry.newIndex, oldIndex);
    newIndex = entry.newIndex + 1;
    if (applyPair(pair)) {
      result.editedParagraphs += 1;
    }
    result.paragraphIds.push(pair.old.id);
  }
  await insertGap(paragraphs.length, olds.length);
  deleted.forEach((old) => old.paragraph.delete());
  result.deletedParagraphs = deleted.length;
  await context.sync();
  return result;
}

/**
 * Replaces each range, whose text is `oldText`, with `newText` by changing only the words that
 * differ. A range whose words Word does not find as expected is replaced whole.
 */
export async function replaceTextWithDiff(
  context: Word.RequestContext,
  ranges: Word.Range[],
  oldText: string,
  newText: string
): Promise<void> {
  const { changes } = diffText(oldText, newText);
  const plans = ranges.map((range) => ({
    range,
    edits: changes.map((change) => {
      if (change.oldText.length > 0) {
        const end = change.oldStart + change.oldText.length;
        return { change, location: "Replace" as const, find: searchRange(range, oldText, change.oldStart, end) };
      }
      const anchor = neighbourToken(oldText, change.oldStart);
      return { change, location: anchor.location, find: searchRange(range, oldText, anchor.start, anchor.end) };
    }),
  }));
  await context.sync();

  for (const { range, edits } of plans) {
    const found = edits.map((edit) => edit.find?.() ?? null);
    if (found.some((target) => target === null)) {
      range.insertText(newText, "Replace");
      continue;
    }
    edits.forEach((edit, index) => {
      const target = (found[index] as Located).range;
      if (edit.change.newText.length === 0) {
        target.delete();
      } else {
        target.insertText(edit.change.newText, edit.location);
      }
    });
  }
  await context.sync();
}

/** Inserts the blocks before the span and deletes the span. */
async function replaceAll(
  context: Word.RequestContext,
  span: Word.Paragraph[],
  blocks: Block[]
): Promise<ReplaceResult> {
  const inserted = await writeBlocks(context, { kind: "paragraph", paragraph: span[0], location: "Before" }, blocks);
  span.forEach((paragraph) => paragraph.delete());
  await context.sync();
  return {
    paragraphIds: inserted.paragraphIds,
    editedParagraphs: 0,
    insertedParagraphs: inserted.paragraphIds.length,
    deletedParagraphs: span.length,
    insertedTables: inserted.tables,
  };
}

/** The old paragraphs, or null when one of them is in a table. */
async function loadOld(context: Word.RequestContext, span: Word.Paragraph[]): Promise<OldParagraph[] | null> {
  const styles = context.document.getStyles();
  span.forEach((paragraph) => {
    paragraph.load("uniqueLocalId,text,style,styleBuiltIn,isListItem,tableNestingLevel");
    paragraph.listItemOrNullObject.load("level");
    paragraph.listOrNullObject.load("levelTypes");
  });
  await context.sync();
  if (span.some((paragraph) => paragraph.tableNestingLevel > 0)) {
    return null;
  }

  const olds = span.map((paragraph): OldParagraph => {
    const listItem = paragraph.listItemOrNullObject;
    const list = paragraph.listOrNullObject;
    const style = styles.getByNameOrNullObject(paragraph.style);
    style.load("font/name");
    return {
      paragraph,
      id: paragraph.uniqueLocalId,
      text: paragraph.text,
      styleBuiltIn: paragraph.styleBuiltIn,
      list:
        paragraph.isListItem && !listItem.isNullObject && !list.isNullObject
          ? { level: listItem.level, ordered: list.levelTypes[listItem.level] === Word.ListLevelType.number }
          : null,
      style,
    };
  });
  await context.sync();
  return olds;
}

/** A list item can become a plain paragraph, but a plain paragraph is not made a list item here. */
function isPair(old: OldParagraph, block: ParagraphBlock): boolean {
  if (block.list && (!old.list || old.list.ordered !== block.list.ordered)) {
    return false;
  }
  return similarity(old.text, blockText(block)) >= MIN_SIMILARITY;
}

/**
 * Queues the searches for the pair's changed text and for its unchanged text, and returns
 * functions that give the found ranges after the next sync. Null when the old text cannot be
 * searched for.
 */
function planPair(old: OldParagraph, block: ParagraphBlock): { pair: Pair; searches: (() => Located | null)[] } | null {
  const newText = blockText(block);
  const diff = diffText(old.text, newText);
  const searches: (() => Located | null)[] = [];
  const pair: Pair = { old, block, changes: [], formats: [] };
  const find = (start: number, end: number, use: (target: Located) => void): boolean => {
    const search = searchRange(old.paragraph, old.text, start, end);
    if (!search) {
      return false;
    }
    searches.push(() => {
      const range = search();
      if (range) {
        use(range);
      }
      return range;
    });
    return true;
  };

  for (const change of diff.changes) {
    const edit: ChangeEdit = {
      change,
      target: null,
      location: "Replace",
      segments: segments(block.runs, change.newStart, change.newStart + change.newText.length),
    };
    pair.changes.push(edit);
    let found = true;
    if (change.oldText.length > 0) {
      found = find(change.oldStart, change.oldStart + change.oldText.length, (target) => (edit.target = target));
    } else if (old.text.length === 0) {
      edit.location = "Start";
    } else {
      const anchor = neighbourToken(old.text, change.oldStart);
      edit.location = anchor.location;
      found = find(anchor.start, anchor.end, (target) => (edit.target = target));
    }
    if (!found) {
      return null;
    }
  }

  for (const equal of diff.equal) {
    for (const segment of runSpans(block.runs, equal.newStart, equal.newStart + equal.length)) {
      if (segment.text.trim().length === 0) {
        continue;
      }
      const start = equal.oldStart + segment.start - equal.newStart;
      const edit = { target: null as unknown as Located, format: segment.format };
      if (!find(start, start + segment.text.length, (target) => (edit.target = target))) {
        return null;
      }
      pair.formats.push(edit);
    }
  }
  return { pair, searches };
}

/** Applies the pair's edits. Returns whether anything changed. */
function applyPair(pair: Pair): boolean {
  const { old, block } = pair;
  const styleFont = old.style.isNullObject ? "" : old.style.font.name;
  let changed = false;

  for (const edit of pair.changes) {
    const { target } = edit;
    if (edit.segments.length === 0) {
      target?.range.delete();
      changed = true;
      continue;
    }
    let range: Word.Range;
    if (edit.location === "Start") {
      range = old.paragraph.insertText(edit.segments[0].text, "Start");
    } else {
      range = (target as Located).range.insertText(edit.segments[0].text, edit.location);
    }
    const ranges = [range];
    for (const segment of edit.segments.slice(1)) {
      ranges.push(ranges[ranges.length - 1].insertText(segment.text, "After"));
    }
    edit.segments.forEach((segment, index) =>
      setFormat(ranges[index], segment.format, target?.font ?? null, styleFont)
    );
    changed = true;
  }

  for (const edit of pair.formats) {
    changed = setFormat(edit.target.range, edit.format, edit.target.font, styleFont) || changed;
  }

  const { paragraph } = old;
  if (old.list && block.list) {
    if (old.list.level !== block.list.level) {
      paragraph.listItem.level = block.list.level;
      changed = true;
    }
  } else if (old.list) {
    paragraph.detachFromList();
    paragraph.styleBuiltIn = block.style;
    changed = true;
  } else if (
    old.styleBuiltIn !== block.style &&
    (block.style !== Word.BuiltInStyleName.normal || MARKDOWN_STYLES.has(old.styleBuiltIn))
  ) {
    paragraph.styleBuiltIn = block.style;
    changed = true;
  }
  return changed;
}

/**
 * Sets the formatting Markdown can express where the range differs from it. `have` is the range's
 * current formatting, or null when it is not known. Returns whether anything was set.
 */
function setFormat(range: Word.Range, want: RunFormat, have: FontState | null, styleFont: string): boolean {
  let changed = false;
  if (have?.bold !== !!want.bold) {
    range.font.bold = !!want.bold;
    changed = true;
  }
  if (have?.italic !== !!want.italic) {
    range.font.italic = !!want.italic;
    changed = true;
  }
  if (have?.strike !== !!want.strike) {
    range.font.strikeThrough = !!want.strike;
    changed = true;
  }
  if (want.code && have?.name !== CODE_FONT) {
    range.font.name = CODE_FONT;
    changed = true;
  } else if (!want.code && have?.name === CODE_FONT && styleFont) {
    range.font.name = styleFont;
    changed = true;
  }
  const link = want.link ?? "";
  if ((have?.hyperlink ?? "") !== link) {
    range.hyperlink = link;
    changed = true;
  }
  return changed;
}

/** The runs' text from `start` to `end` in the joined text, split where the format changes. */
function segments(runs: Run[], start: number, end: number): Segment[] {
  return runSpans(runs, start, end).map(({ text, format }) => ({ text, format }));
}

function runSpans(runs: Run[], start: number, end: number): (Segment & { start: number })[] {
  const spans: (Segment & { start: number })[] = [];
  let offset = 0;
  for (const { text, ...format } of runs) {
    const from = Math.max(start, offset);
    const to = Math.min(end, offset + text.length);
    if (from < to) {
      spans.push({ text: text.slice(from - offset, to - offset), format, start: from });
    }
    offset += text.length;
  }
  return spans;
}

/** The token before `offset` to insert after, or at the start of the text the token after it. */
function neighbourToken(text: string, offset: number): { start: number; end: number; location: "After" | "Before" } {
  let start = 0;
  for (const token of tokenize(text)) {
    const end = start + token.length;
    if (offset === 0) {
      return { start, end, location: "Before" };
    }
    if (end === offset) {
      return { start, end, location: "After" };
    }
    start = end;
  }
  throw new Error("No text next to the insertion.");
}

/**
 * Queues a search for `text` from `start` to `end` in the scope, whose text is `text`, and returns a function that
 * gives the found range after the next sync, or null when Word's matches differ from the text's.
 * Text longer than Word's search limit is found as a head and a tail.
 */
function searchRange(
  scope: Word.Paragraph | Word.Range,
  text: string,
  start: number,
  end: number
): (() => Located | null) | null {
  const headEnd = searchableEnd(text, start, end, 1);
  if (headEnd === end) {
    const head = search(scope, text, start, end);
    return head && (() => head().map((range) => new Located(range))[0] ?? null);
  }
  const tailStart = searchableEnd(text, end, start, -1);
  const head = search(scope, text, start, headEnd);
  const tail = search(scope, text, tailStart, end);
  if (!head || !tail) {
    return null;
  }
  return () => {
    const [from] = head();
    const [to] = tail();
    return from && to ? new Located(from.expandTo(to)) : null;
  };
}

/** Queues a search for the text from `start` to `end`. After the sync, gives that occurrence's range, if Word found it. */
function search(
  scope: Word.Paragraph | Word.Range,
  text: string,
  start: number,
  end: number
): (() => Word.Range[]) | null {
  const needle = text.slice(start, end);
  const occurrence = occurrenceOf(text, needle, start);
  if (occurrence === null) {
    return null;
  }
  const results = scope.search(escapeSearch(needle), { matchCase: true });
  results.load("items/text");
  return () => {
    const range = results.items[occurrence.index];
    return results.items.length === occurrence.count && range?.text === needle ? [range] : [];
  };
}

/** Which of the needle's matches starts at `start`, counting matches from the left without overlap as Word does. */
function occurrenceOf(text: string, needle: string, start: number): { index: number; count: number } | null {
  let index = -1;
  let count = 0;
  for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + needle.length)) {
    if (at === start) {
      index = count;
    }
    count += 1;
  }
  return index >= 0 ? { index, count } : null;
}

/** The furthest offset from `from` towards `limit` (`step` 1 or -1) whose text fits in one Word search. */
function searchableEnd(text: string, from: number, limit: number, step: 1 | -1): number {
  let length = 0;
  let at = from;
  while (at !== limit) {
    const char = step === 1 ? text[at] : text[at - 1];
    length += escapeSearch(char).length;
    if (length > MAX_SEARCH) {
      break;
    }
    at += step;
  }
  return at;
}

/** Word's search treats ^ as a special character and finds tabs, manual line breaks and non-breaking spaces with codes. */
function escapeSearch(text: string): string {
  return text
    .replace(/\^/g, "^^")
    .replace(/\t/g, "^t")
    .replace(/\v/g, "^l")
    .replace(/\u00a0/g, "^s");
}
