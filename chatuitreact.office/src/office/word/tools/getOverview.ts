/* global Office */

import type { OfficeToolDefinition } from "../../shared/officeTool";
import { headingLevel, runWord } from "./shared";

export const getOverview: OfficeToolDefinition = {
  name: "word_get_overview",
  description:
    "Get an overview of the open Word document: title, paragraph count, headings (id, level, text), " +
    "the ids of the selected paragraphs, the Track Changes mode, the section count, tables (index, the id of " +
    "their first paragraph, rows, cells in the first row), and the counts of inline pictures, floating shapes (pictures, text boxes and shapes; null when Word cannot report them), content controls, comments and tracked " +
    "changes.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  handler: (_args, signal) =>
    runWord(signal, async (context) => {
      const doc = context.document;
      doc.load("changeTrackingMode");
      doc.properties.load("title");
      const body = doc.body;
      const paragraphs = body.paragraphs;
      paragraphs.load("items/uniqueLocalId,items/text,items/styleBuiltIn");
      const selected = doc.getSelection().paragraphs;
      selected.load("items/uniqueLocalId");
      const sections = doc.sections;
      sections.load("items");
      const tables = body.tables;
      tables.load("items/rowCount");
      const pictures = body.inlinePictures;
      pictures.load("items");
      // Floating pictures, text boxes and shapes are not inline pictures; they need WordApiDesktop 1.2.
      const shapes = Office.context.requirements.isSetSupported("WordApiDesktop", "1.2") ? body.shapes : null;
      shapes?.load("items");
      const contentControls = body.contentControls;
      contentControls.load("items");
      const comments = body.getComments();
      comments.load("items");
      const trackedChanges = body.getTrackedChanges();
      trackedChanges.load("items");
      await context.sync();

      const firstCells = tables.items.map((table) => {
        const paragraph = table.getCell(0, 0).body.paragraphs.getFirst().load("uniqueLocalId");
        const row = table.rows.getFirst().load("cellCount");
        return { paragraph, row };
      });
      await context.sync();

      const headings = paragraphs.items.flatMap((paragraph) => {
        const level = headingLevel(paragraph.styleBuiltIn);
        return level === null ? [] : [{ id: paragraph.uniqueLocalId, level, text: paragraph.text }];
      });
      return {
        title: doc.properties.title,
        paragraphCount: paragraphs.items.length,
        headings,
        selectionParagraphIds: selected.items.map((paragraph) => paragraph.uniqueLocalId),
        trackChangesMode: doc.changeTrackingMode,
        sectionCount: sections.items.length,
        tables: tables.items.map((table, index) => ({
          index,
          firstParagraphId: firstCells[index].paragraph.uniqueLocalId,
          rows: table.rowCount,
          columns: firstCells[index].row.cellCount,
        })),
        inlinePictureCount: pictures.items.length,
        floatingShapeCount: shapes ? shapes.items.length : null,
        contentControlCount: contentControls.items.length,
        commentCount: comments.items.length,
        trackedChangeCount: trackedChanges.items.length,
      };
    }),
};
