/* global OfficeExtension, Word */

import {
  optionalBoolean,
  optionalInteger,
  optionalNumber,
  optionalOneOf,
  ToolArgumentError,
} from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { describeError } from "../../../chat/conversation/conversation";
import { describeWordError, runWord } from "./shared";

const ORIENTATIONS = ["Portrait", "Landscape"] as const;
const PAPER_SIZES = [
  "A3",
  "A4",
  "A5",
  "B4",
  "B5",
  "Letter",
  "Legal",
  "Executive",
  "Tabloid",
  "Ledger",
  "Statement",
] as const;
const DISTANCES = [
  "topMargin",
  "bottomMargin",
  "leftMargin",
  "rightMargin",
  "headerDistance",
  "footerDistance",
] as const;

export const pageSetup: OfficeToolDefinition = {
  name: "word_page_setup",
  description:
    "Change the page setup of one section (sectionIndex, 0-based, see the section count in word_get_overview) " +
    "or of every section: margins and header/footer distances in points, orientation, paper size, text columns, " +
    "different first page and different odd and even pages headers and footers. Returns the page setup of the " +
    "sections; call it without changes to read it. Use word_insert_break for new sections.",
  requires: { set: "WordApiDesktop", version: "1.3" },
  parameters: {
    type: "object",
    properties: {
      sectionIndex: { type: "integer", minimum: 0, description: "Omit for every section." },
      topMargin: { type: "number", minimum: 0 },
      bottomMargin: { type: "number", minimum: 0 },
      leftMargin: { type: "number", minimum: 0 },
      rightMargin: { type: "number", minimum: 0 },
      headerDistance: { type: "number", minimum: 0 },
      footerDistance: { type: "number", minimum: 0 },
      orientation: { type: "string", enum: [...ORIENTATIONS] },
      paperSize: { type: "string", enum: [...PAPER_SIZES] },
      columns: { type: "integer", minimum: 1, maximum: 12, description: "Number of text columns." },
      differentFirstPage: { type: "boolean" },
      differentOddEven: { type: "boolean" },
    },
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const sectionIndex = optionalInteger(args, "sectionIndex");
    const distances: Partial<Record<(typeof DISTANCES)[number], number>> = {};
    for (const name of DISTANCES) {
      const value = optionalNumber(args, name);
      if (value !== undefined) {
        if (value < 0) {
          throw new ToolArgumentError(`"${name}" must be at least 0.`);
        }
        distances[name] = value;
      }
    }
    const orientation = optionalOneOf(args, "orientation", ORIENTATIONS);
    const paperSize = optionalOneOf(args, "paperSize", PAPER_SIZES);
    const columns = optionalInteger(args, "columns");
    if (columns !== undefined && (columns < 1 || columns > 12)) {
      throw new ToolArgumentError(`"columns" must be an integer from 1 to 12.`);
    }
    const differentFirstPage = optionalBoolean(args, "differentFirstPage");
    const differentOddEven = optionalBoolean(args, "differentOddEven");

    return runWord(signal, async (context) => {
      const sections = context.document.sections;
      sections.load("items");
      await context.sync();
      if (sectionIndex !== undefined && sectionIndex >= sections.items.length) {
        throw new Error(`The document has ${sections.items.length} sections.`);
      }
      const targets = sectionIndex === undefined ? sections.items : [sections.items[sectionIndex]];

      // Each change is synced on its own, so one setting the host rejects does not stop the others, and the
      // error names the setting.
      const changes: Array<[string, (setup: Word.PageSetup) => void]> = [];
      for (const [name, value] of Object.entries(distances)) {
        changes.push([name, (setup) => (setup[name as (typeof DISTANCES)[number]] = value)]);
      }
      if (orientation !== undefined) {
        changes.push(["orientation", (setup) => (setup.orientation = orientation)]);
      }
      if (paperSize !== undefined) {
        changes.push(["paperSize", (setup) => (setup.paperSize = paperSize)]);
      }
      if (columns !== undefined) {
        changes.push(["columns", (setup) => setup.textColumns.setCount(columns)]);
      }
      if (differentFirstPage !== undefined) {
        changes.push(["differentFirstPage", (setup) => (setup.differentFirstPageHeaderFooter = differentFirstPage)]);
      }
      if (differentOddEven !== undefined) {
        changes.push(["differentOddEven", (setup) => (setup.oddAndEvenPagesHeaderFooter = differentOddEven)]);
      }
      const failures: string[] = [];
      for (const [name, apply] of changes) {
        try {
          targets.forEach((section) => apply(section.pageSetup));
          // eslint-disable-next-line office-addins/no-context-sync-in-loop
          await context.sync();
        } catch (error) {
          failures.push(
            `${name}: ${error instanceof OfficeExtension.Error ? describeWordError(error) : describeError(error)}`
          );
        }
      }
      if (failures.length > 0) {
        const applied = changes.map(([name]) => name).filter((name) => !failures.some((f) => f.startsWith(`${name}:`)));
        throw new Error(
          `Word rejected ${failures.join(" | ")}. ${applied.length > 0 ? `Applied: ${applied.join(", ")}.` : "Nothing was applied."}`
        );
      }

      const setups = targets.map((section) => {
        const setup = section.pageSetup;
        setup.load(
          [
            ...DISTANCES,
            "orientation",
            "paperSize",
            "differentFirstPageHeaderFooter",
            "oddAndEvenPagesHeaderFooter",
          ].join(",")
        );
        setup.textColumns.load("items");
        return setup;
      });
      await context.sync();
      return {
        sections: setups.map((setup, index) => ({
          sectionIndex: sectionIndex ?? index,
          topMargin: setup.topMargin,
          bottomMargin: setup.bottomMargin,
          leftMargin: setup.leftMargin,
          rightMargin: setup.rightMargin,
          headerDistance: setup.headerDistance,
          footerDistance: setup.footerDistance,
          orientation: setup.orientation,
          paperSize: setup.paperSize,
          columns: setup.textColumns.items.length,
          differentFirstPage: setup.differentFirstPageHeaderFooter,
          differentOddEven: setup.oddAndEvenPagesHeaderFooter,
        })),
      };
    });
  },
};
