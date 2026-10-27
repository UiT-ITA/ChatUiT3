/* global Office, Word */

import { joinContext, readWith } from "../shared/context";
import { getOverview } from "./tools/getOverview";
import { getSelection } from "./tools/getSelection";
import { readParagraphs } from "./tools/readParagraphs";

/** The most paragraphs of the current page the context holds, which is also word_read_paragraphs' limit. */
const MAX_PARAGRAPHS = 50;
/** Without a page, the paragraphs around the cursor: this many before it. */
const BEFORE_CURSOR = 15;

/**
 * What the user is looking at in Word: the document overview, the selection and, when nothing is selected, the
 * paragraphs of the page with the cursor.
 */
export async function wordContext(): Promise<string> {
  let selected = false;
  return joinContext("Word.", [
    ["Document overview", () => readWith(getOverview)],
    [
      "Selection",
      async () => {
        const selection = (await readWith(getSelection)) as { text: string; paragraphIds: string[] };
        selected = selection.text.trim().length > 0;
        return selected ? selection : { note: "Nothing is selected.", cursorParagraphIds: selection.paragraphIds };
      },
    ],
    ["Current page", () => (selected ? Promise.resolve(null) : readCurrentPage())],
  ]);
}

/** The paragraphs of the page with the cursor, or the paragraphs around it when Word cannot tell pages. */
async function readCurrentPage(): Promise<unknown> {
  const span = await Word.run(async (context) => {
    const all = context.document.body.paragraphs.load("items/uniqueLocalId");
    const cursor = context.document.getSelection().paragraphs.getFirst().load("uniqueLocalId");
    const page = Office.context.requirements.isSetSupported("WordApiDesktop", "1.2")
      ? context.document.getSelection().pages.getFirst().getRange().paragraphs.load("items/uniqueLocalId")
      : null;
    await context.sync();
    const ids = all.items.map((paragraph) => paragraph.uniqueLocalId);
    if (page && page.items.length > 0) {
      return { start: ids.indexOf(page.items[0].uniqueLocalId), count: page.items.length, ids, page: true };
    }
    const start = ids.indexOf(cursor.uniqueLocalId) - BEFORE_CURSOR;
    return { start, count: MAX_PARAGRAPHS, ids, page: false };
  });
  const start = Math.max(0, span.start);
  const paragraphs = (await readWith(readParagraphs, {
    ...(start > 0 ? { afterId: span.ids[start - 1] } : {}),
    count: Math.min(span.count, MAX_PARAGRAPHS),
  })) as Record<string, unknown>;
  return span.page ? paragraphs : { note: "Word cannot tell pages: the paragraphs around the cursor.", ...paragraphs };
}
