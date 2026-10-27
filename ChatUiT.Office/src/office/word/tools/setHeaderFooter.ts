import { optionalInteger, optionalOneOf, optionalString, requireOneOf } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { insertMarkdown } from "../markdownToWord";
import { markdownHint } from "./markdownHint";
import { runWord } from "./shared";

const KINDS = ["header", "footer"] as const;
const TYPES = { primary: "Primary", firstPage: "FirstPage", evenPages: "EvenPages" } as const;
const PAGE_NUMBERS = ["pageX", "pageXOfY"] as const;
const ALIGNMENTS = { left: "Left", center: "Centered", right: "Right" } as const;

export const setHeaderFooter: OfficeToolDefinition = {
  name: "word_set_header_footer",
  description:
    "Replace a header or footer of one section (sectionIndex, 0-based) or of every section with Markdown content " +
    'and optional page numbers ("Page X" or "Page X of Y") in a last paragraph. Giving neither clears it. ' +
    "firstPage and evenPages show only when word_page_setup turns on differentFirstPage or differentOddEven. " +
    markdownHint,
  parameters: {
    type: "object",
    properties: {
      kind: { type: "string", enum: [...KINDS] },
      type: { type: "string", enum: Object.keys(TYPES), description: "Default primary." },
      sectionIndex: { type: "integer", minimum: 0, description: "Omit for every section." },
      markdown: { type: "string" },
      pageNumbers: { type: "string", enum: [...PAGE_NUMBERS] },
      pageNumberAlignment: { type: "string", enum: Object.keys(ALIGNMENTS), description: "Default center." },
    },
    required: ["kind"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const kind = requireOneOf(args, "kind", KINDS);
    const type = TYPES[optionalOneOf(args, "type", Object.keys(TYPES) as Array<keyof typeof TYPES>) ?? "primary"];
    const sectionIndex = optionalInteger(args, "sectionIndex");
    const markdown = optionalString(args, "markdown");
    const pageNumbers = optionalOneOf(args, "pageNumbers", PAGE_NUMBERS);
    const alignment =
      ALIGNMENTS[
        optionalOneOf(args, "pageNumberAlignment", Object.keys(ALIGNMENTS) as Array<keyof typeof ALIGNMENTS>) ??
          "center"
      ];

    return runWord(signal, async (context) => {
      const sections = context.document.sections;
      sections.load("items");
      await context.sync();
      if (sectionIndex !== undefined && sectionIndex >= sections.items.length) {
        throw new Error(`The document has ${sections.items.length} sections.`);
      }
      const targets = sectionIndex === undefined ? sections.items : [sections.items[sectionIndex]];

      for (const section of targets) {
        const body = kind === "header" ? section.getHeader(type) : section.getFooter(type);
        body.clear();
        // Clearing leaves one empty paragraph: the Markdown goes before it and the page numbers into it.
        const last = body.paragraphs.getFirst();
        if (markdown) {
          await insertMarkdown(context, { kind: "paragraph", paragraph: last, location: "Before" }, markdown);
        }
        if (pageNumbers) {
          last.insertText("Page ", "End");
          last.getRange("Content").insertField("End", "Page");
          if (pageNumbers === "pageXOfY") {
            last.insertText(" of ", "End");
            last.getRange("Content").insertField("End", "NumPages");
          }
          last.alignment = alignment;
        } else if (markdown) {
          last.delete();
        }
      }
      await context.sync();
      return { sections: targets.length, kind, type };
    });
  },
};
