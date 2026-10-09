/* global Word */

import { marked, type Token, type Tokens } from "marked";

/**
 * Inserts Markdown as native Word content: headings get the built-in heading styles, lists use
 * Word lists, tables use Word tables and inline formatting is set on the text ranges. Nothing
 * else is styled, so the inserted content takes the document's own styles.
 */

export type InsertTarget =
  | { kind: "body"; location: "Start" | "End" }
  | { kind: "paragraph"; paragraph: Word.Paragraph; location: "Before" | "After" }
  | { kind: "selection"; range: Word.Range };

export interface InsertResult {
  /** Ids of the inserted paragraphs outside tables, in document order. */
  paragraphIds: string[];
  tables: number;
}

interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: string;
}

type RunFormat = Omit<Run, "text">;
type BlockTarget = Exclude<InsertTarget, { kind: "selection" }>;

const CODE_FONT = "Consolas";
/** Word's manual line break. */
const LINE_BREAK = "\v";

export async function insertMarkdown(
  context: Word.RequestContext,
  target: InsertTarget,
  markdown: string
): Promise<InsertResult> {
  const blocks = marked.lexer(markdown).filter((token) => token.type !== "space");
  if (target.kind === "selection") {
    return insertAtSelection(context, target.range, blocks);
  }
  const writer = new BlockWriter(context, target);
  await writer.writeBlocks(blocks);
  return writer.finish();
}

async function insertAtSelection(
  context: Word.RequestContext,
  range: Word.Range,
  blocks: Token[]
): Promise<InsertResult> {
  // A single paragraph replaces the selection in place, inside the current paragraph.
  if (blocks.length === 1 && blocks[0].type === "paragraph") {
    const runs = inlineRuns((blocks[0] as Tokens.Paragraph).tokens);
    const paragraphs = writeRunsInPlace(range, runs).paragraphs;
    paragraphs.load("items/uniqueLocalId");
    await context.sync();
    return { paragraphIds: paragraphs.items.map((paragraph) => paragraph.uniqueLocalId), tables: 0 };
  }

  // Several blocks go after the selected paragraphs, then the selection is removed.
  const selected = range.paragraphs;
  range.load("text");
  selected.load("items/text");
  await context.sync();
  if (selected.items.length === 0) {
    throw new Error("The selection is not in the document body.");
  }

  const last = selected.items[selected.items.length - 1];
  const writer = new BlockWriter(context, { kind: "paragraph", paragraph: last, location: "After" });
  await writer.writeBlocks(blocks);

  const selectedText = selected.items.map((paragraph) => paragraph.text).join("");
  if (compact(range.text) === compact(selectedText)) {
    selected.items.forEach((paragraph) => paragraph.delete());
  } else if (range.text.length > 0) {
    range.delete();
  }
  return writer.finish();
}

interface Inserted {
  paragraph: Word.Paragraph;
  isListItem: boolean;
}

class BlockWriter {
  private last: Word.Paragraph | Word.Table | null = null;
  private readonly inserted: Inserted[] = [];
  private tables = 0;

  constructor(
    private readonly context: Word.RequestContext,
    private readonly target: BlockTarget
  ) {}

  async writeBlocks(blocks: Token[]): Promise<void> {
    for (const block of blocks) {
      await this.writeBlock(block);
    }
  }

  /**
   * A paragraph inserted next to a list item joins that list, so every inserted paragraph that
   * is not meant to be a list item is taken out of any list here.
   */
  async finish(): Promise<InsertResult> {
    for (const entry of this.inserted) {
      entry.paragraph.load(entry.isListItem ? "uniqueLocalId" : "uniqueLocalId,isListItem");
    }
    await this.context.sync();
    for (const entry of this.inserted) {
      if (!entry.isListItem && entry.paragraph.isListItem) {
        entry.paragraph.detachFromList();
      }
    }
    await this.context.sync();
    return {
      paragraphIds: this.inserted.map((entry) => entry.paragraph.uniqueLocalId),
      tables: this.tables,
    };
  }

  private async writeBlock(token: Token): Promise<void> {
    switch (token.type) {
      case "heading": {
        const heading = token as Tokens.Heading;
        const depth = Math.min(Math.max(heading.depth, 1), 6);
        this.textParagraph(`Heading${depth}` as Word.BuiltInStyleName, inlineRuns(heading.tokens));
        return;
      }
      case "paragraph":
      case "text":
        this.textParagraph(Word.BuiltInStyleName.normal, blockRuns(token));
        return;
      case "blockquote":
        for (const child of (token as Tokens.Blockquote).tokens) {
          if (child.type === "paragraph" || child.type === "text") {
            this.textParagraph(Word.BuiltInStyleName.quote, blockRuns(child));
          } else if (child.type !== "space") {
            await this.writeBlock(child);
          }
        }
        return;
      case "code":
        for (const line of (token as Tokens.Code).text.split("\n")) {
          this.textParagraph(Word.BuiltInStyleName.normal, [{ text: line, code: true }]);
        }
        return;
      case "list":
        await this.writeList(token as Tokens.List, 0, null);
        return;
      case "table":
        this.writeTable(token as Tokens.Table);
        return;
      case "hr":
      case "space":
      case "def":
        return;
      default:
        this.textParagraph(Word.BuiltInStyleName.normal, blockRuns(token));
    }
  }

  private textParagraph(style: Word.BuiltInStyleName, runs: Run[]): void {
    const paragraph = this.newParagraph();
    paragraph.styleBuiltIn = style;
    writeRunsAtEnd(paragraph, runs);
    this.inserted.push({ paragraph, isListItem: false });
  }

  private async writeList(list: Tokens.List, level: number, parent: Word.List | null): Promise<void> {
    let wordList = parent;
    let levelConfigured = false;

    for (const item of list.items) {
      let paragraph: Word.Paragraph;
      if (wordList === null) {
        paragraph = this.newParagraph();
        paragraph.load("isListItem");
        await this.context.sync();
        if (paragraph.isListItem) {
          paragraph.detachFromList();
        }
        wordList = paragraph.startNewList();
      } else {
        paragraph = wordList.insertParagraph("", "End");
        this.last = paragraph;
      }
      if (!levelConfigured) {
        configureLevel(wordList, level, list.ordered);
        levelConfigured = true;
      }
      paragraph.listItem.level = level;
      this.inserted.push({ paragraph, isListItem: true });

      const runs: Run[] = item.task ? [{ text: item.checked ? "☑ " : "☐ " }] : [];
      let hasText = false;
      for (const child of item.tokens) {
        if (child.type === "list") {
          await this.writeList(child as Tokens.List, level + 1, wordList);
        } else if (child.type !== "space") {
          if (hasText) {
            runs.push({ text: LINE_BREAK });
          }
          runs.push(...blockRuns(child));
          hasText = true;
        }
      }
      writeRunsAtEnd(paragraph, runs);
    }
  }

  private writeTable(token: Tokens.Table): void {
    const columns = token.header.length;
    const cells = (row: Tokens.TableCell[]) =>
      Array.from({ length: columns }, (_, index) => plainText(row[index]?.tokens ?? []));
    const values = [cells(token.header), ...token.rows.map(cells)];

    let table: Word.Table;
    if (this.last) {
      table = this.last.insertTable(values.length, columns, "After", values);
    } else if (this.target.kind === "body") {
      table = this.context.document.body.insertTable(values.length, columns, this.target.location, values);
    } else {
      table = this.target.paragraph.insertTable(values.length, columns, this.target.location, values);
    }
    table.headerRowCount = 1;
    this.last = table;
    this.tables += 1;
  }

  private newParagraph(): Word.Paragraph {
    let paragraph: Word.Paragraph;
    if (this.last) {
      paragraph = this.last.insertParagraph("", "After");
    } else if (this.target.kind === "body") {
      paragraph = this.context.document.body.insertParagraph("", this.target.location);
    } else {
      paragraph = this.target.paragraph.insertParagraph("", this.target.location);
    }
    this.last = paragraph;
    return paragraph;
  }
}

function configureLevel(list: Word.List, level: number, ordered: boolean): void {
  if (ordered) {
    list.setLevelNumbering(level, Word.ListNumbering.arabic, [level, "."]);
  } else {
    list.setLevelBullet(level, Word.ListBullet.solid);
  }
}

/** Inserts the runs at the end of the paragraph, then formats them, so no run inherits another's format. */
function writeRunsAtEnd(paragraph: Word.Paragraph, runs: Run[]): void {
  const texts = runs.filter((run) => run.text.length > 0);
  const ranges = texts.map((run) => paragraph.insertText(run.text, "End"));
  texts.forEach((run, index) => formatRun(ranges[index], run));
}

/** Replaces the range with the runs and returns the range of the first run. */
function writeRunsInPlace(range: Word.Range, runs: Run[]): Word.Range {
  const texts = runs.filter((run) => run.text.length > 0);
  if (texts.length === 0) {
    return range.insertText("", "Replace");
  }
  const ranges: Word.Range[] = [range.insertText(texts[0].text, "Replace")];
  for (const run of texts.slice(1)) {
    ranges.push(ranges[ranges.length - 1].insertText(run.text, "After"));
  }
  texts.forEach((run, index) => formatRun(ranges[index], run));
  return ranges[0];
}

function formatRun(range: Word.Range, run: Run): void {
  if (run.bold) {
    range.font.bold = true;
  }
  if (run.italic) {
    range.font.italic = true;
  }
  if (run.strike) {
    range.font.strikeThrough = true;
  }
  if (run.code) {
    range.font.name = CODE_FONT;
  }
  if (run.link) {
    range.hyperlink = run.link;
  }
}

function blockRuns(token: Token): Run[] {
  if (token.type === "code") {
    return [{ text: (token as Tokens.Code).text, code: true }];
  }
  const inline = (token as { tokens?: Token[] }).tokens;
  if (inline) {
    return inlineRuns(inline);
  }
  const text = (token as { text?: unknown }).text;
  return [{ text: typeof text === "string" ? text : token.raw.trim() }];
}

function inlineRuns(tokens: Token[] | undefined, format: RunFormat = {}): Run[] {
  const runs: Run[] = [];
  for (const token of tokens ?? []) {
    switch (token.type) {
      case "strong":
        runs.push(...inlineRuns((token as Tokens.Strong).tokens, { ...format, bold: true }));
        break;
      case "em":
        runs.push(...inlineRuns((token as Tokens.Em).tokens, { ...format, italic: true }));
        break;
      case "del":
        runs.push(...inlineRuns((token as Tokens.Del).tokens, { ...format, strike: true }));
        break;
      case "codespan":
        runs.push({ ...format, text: (token as Tokens.Codespan).text, code: true });
        break;
      case "link": {
        const link = token as Tokens.Link;
        const href = safeHref(link.href);
        runs.push(...inlineRuns(link.tokens, href ? { ...format, link: href } : format));
        break;
      }
      case "br":
        runs.push({ ...format, text: LINE_BREAK });
        break;
      case "image":
        runs.push({ ...format, text: (token as Tokens.Image).text });
        break;
      case "html":
        // Inline HTML tags are dropped, except line breaks.
        if (/^<br\s*\/?>$/i.test((token as Tokens.Tag).text.trim())) {
          runs.push({ ...format, text: LINE_BREAK });
        }
        break;
      default: {
        const nested = (token as { tokens?: Token[] }).tokens;
        if (nested && nested.length > 0) {
          runs.push(...inlineRuns(nested, format));
        } else {
          const text = (token as { text?: unknown }).text;
          runs.push({ ...format, text: typeof text === "string" ? text : token.raw });
        }
      }
    }
  }
  return runs;
}

function plainText(tokens: Token[]): string {
  return inlineRuns(tokens)
    .map((run) => run.text)
    .join("")
    .split(LINE_BREAK)
    .join(" ");
}

function safeHref(href: string): string | undefined {
  return /^(https?:|mailto:)/i.test(href.trim()) ? href.trim() : undefined;
}

function compact(text: string): string {
  return text.replace(/\s+/g, "");
}
