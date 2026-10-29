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

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: string;
}

export type RunFormat = Omit<Run, "text">;
export type BlockTarget = Exclude<InsertTarget, { kind: "selection" }>;

export interface ListPlacement {
  ordered: boolean;
  level: number;
  /** The first item of a top-level list, which starts a new Word list. */
  startsList: boolean;
  /** The first item of its Markdown list, which sets the numbering or bullet of its level. */
  configuresLevel: boolean;
}

/** A paragraph to write. `style` applies only when `list` is null. */
export interface ParagraphBlock {
  kind: "paragraph";
  style: Word.BuiltInStyleName;
  runs: Run[];
  list: ListPlacement | null;
}

export interface TableBlock {
  kind: "table";
  values: string[][];
}

export type Block = ParagraphBlock | TableBlock;

export const CODE_FONT = "Consolas";
/** Word's manual line break. */
const LINE_BREAK = "\v";

export async function insertMarkdown(
  context: Word.RequestContext,
  target: InsertTarget,
  markdown: string
): Promise<InsertResult> {
  const tokens = marked.lexer(markdown).filter((token) => token.type !== "space");
  if (target.kind === "selection") {
    return insertAtSelection(context, target.range, tokens);
  }
  return writeBlocks(context, target, planTokens(tokens));
}

/** The paragraphs and tables the Markdown becomes, in document order. */
export function planMarkdown(markdown: string): Block[] {
  return planTokens(marked.lexer(markdown).filter((token) => token.type !== "space"));
}

/** Writes the blocks next to the target. */
export async function writeBlocks(
  context: Word.RequestContext,
  target: BlockTarget,
  blocks: Block[]
): Promise<InsertResult> {
  const writer = new BlockWriter(context, target);
  for (const block of blocks) {
    await writer.write(block);
  }
  return writer.finish();
}

export function blockText(block: ParagraphBlock): string {
  return block.runs.map((run) => run.text).join("");
}

async function insertAtSelection(
  context: Word.RequestContext,
  range: Word.Range,
  tokens: Token[]
): Promise<InsertResult> {
  // A single paragraph replaces the selection in place, inside the current paragraph.
  if (tokens.length === 1 && tokens[0].type === "paragraph") {
    const runs = inlineRuns((tokens[0] as Tokens.Paragraph).tokens);
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
  const result = await writeBlocks(
    context,
    { kind: "paragraph", paragraph: last, location: "After" },
    planTokens(tokens)
  );

  const selectedText = selected.items.map((paragraph) => paragraph.text).join("");
  if (compact(range.text) === compact(selectedText)) {
    selected.items.forEach((paragraph) => paragraph.delete());
  } else if (range.text.length > 0) {
    range.delete();
  }
  await context.sync();
  return result;
}

function planTokens(tokens: Token[]): Block[] {
  const blocks: Block[] = [];
  tokens.forEach((token) => planBlock(token, blocks));
  return blocks;
}

function planBlock(token: Token, blocks: Block[]): void {
  const paragraph = (style: Word.BuiltInStyleName, runs: Run[]) =>
    blocks.push({ kind: "paragraph", style, runs, list: null });
  switch (token.type) {
    case "heading": {
      const heading = token as Tokens.Heading;
      const depth = Math.min(Math.max(heading.depth, 1), 6);
      paragraph(`Heading${depth}` as Word.BuiltInStyleName, inlineRuns(heading.tokens));
      return;
    }
    case "paragraph":
    case "text":
      paragraph(Word.BuiltInStyleName.normal, blockRuns(token));
      return;
    case "blockquote":
      for (const child of (token as Tokens.Blockquote).tokens) {
        if (child.type === "paragraph" || child.type === "text") {
          paragraph(Word.BuiltInStyleName.quote, blockRuns(child));
        } else if (child.type !== "space") {
          planBlock(child, blocks);
        }
      }
      return;
    case "code":
      for (const line of (token as Tokens.Code).text.split("\n")) {
        paragraph(Word.BuiltInStyleName.normal, [{ text: line, code: true }]);
      }
      return;
    case "list":
      planList(token as Tokens.List, 0, blocks);
      return;
    case "table":
      blocks.push(planTable(token as Tokens.Table));
      return;
    case "hr":
    case "space":
    case "def":
      return;
    default:
      paragraph(Word.BuiltInStyleName.normal, blockRuns(token));
  }
}

function planList(list: Tokens.List, level: number, blocks: Block[]): void {
  list.items.forEach((item, index) => {
    const runs: Run[] = item.task ? [{ text: item.checked ? "☑ " : "☐ " }] : [];
    blocks.push({
      kind: "paragraph",
      style: Word.BuiltInStyleName.listParagraph,
      runs,
      list: { ordered: list.ordered, level, startsList: level === 0 && index === 0, configuresLevel: index === 0 },
    });
    let hasText = false;
    for (const child of item.tokens) {
      if (child.type === "list") {
        planList(child as Tokens.List, level + 1, blocks);
      } else if (child.type !== "space") {
        if (hasText) {
          runs.push({ text: LINE_BREAK });
        }
        runs.push(...blockRuns(child));
        hasText = true;
      }
    }
  });
}

function planTable(token: Tokens.Table): TableBlock {
  const columns = token.header.length;
  const cells = (row: Tokens.TableCell[]) =>
    Array.from({ length: columns }, (_, index) => plainText(row[index]?.tokens ?? []));
  return { kind: "table", values: [cells(token.header), ...token.rows.map(cells)] };
}

interface Inserted {
  paragraph: Word.Paragraph;
  isListItem: boolean;
}

class BlockWriter {
  private last: Word.Paragraph | Word.Table | null = null;
  private list: Word.List | null = null;
  /** The current list is one the inserted items joined, so items go after the last paragraph. */
  private joinedList = false;
  private readonly inserted: Inserted[] = [];
  private tables = 0;

  constructor(
    private readonly context: Word.RequestContext,
    private readonly target: BlockTarget
  ) {}

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

  async write(block: Block): Promise<void> {
    if (block.kind === "table") {
      this.writeTable(block);
      this.list = null;
      return;
    }
    if (block.list) {
      await this.writeListItem(block, block.list);
      return;
    }
    this.list = null;
    const paragraph = this.newParagraph();
    paragraph.styleBuiltIn = block.style;
    writeRunsAtEnd(paragraph, block.runs);
    this.inserted.push({ paragraph, isListItem: false });
  }

  /**
   * An item that does not start a list continues the current one. Without a current list, the
   * blocks continue a list in the document: the item joins the list next to it, or starts one.
   */
  private async writeListItem(block: ParagraphBlock, placement: ListPlacement): Promise<void> {
    let paragraph: Word.Paragraph;
    let started = false;
    if (placement.startsList || this.list === null) {
      paragraph = this.newParagraph();
      paragraph.load("isListItem");
      await this.context.sync();
      const joins = !placement.startsList && paragraph.isListItem;
      if (joins) {
        this.list = paragraph.list;
      } else {
        if (paragraph.isListItem) {
          paragraph.detachFromList();
        }
        this.list = paragraph.startNewList();
        started = true;
      }
      this.joinedList = joins;
    } else if (this.joinedList) {
      paragraph = this.newParagraph();
    } else {
      paragraph = this.list.insertParagraph("", "End");
      this.last = paragraph;
    }
    if (started || (placement.configuresLevel && !this.joinedList)) {
      configureLevel(this.list, placement.level, placement.ordered);
    }
    paragraph.listItem.level = placement.level;
    this.inserted.push({ paragraph, isListItem: true });
    writeRunsAtEnd(paragraph, block.runs);
  }

  private writeTable(block: TableBlock): void {
    const { values } = block;
    const columns = values[0].length;
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
