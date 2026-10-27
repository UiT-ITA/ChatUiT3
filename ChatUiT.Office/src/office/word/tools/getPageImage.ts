/* global AbortSignal, Office */

import { optionalInteger } from "../../../chat/tools/args";
import { ToolResultWithImages } from "../../../chat/tools/types";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { exportPdf, renderPdfPage } from "../pageImage";
import { runWord } from "./shared";

export const getPageImage: OfficeToolDefinition = {
  name: "word_get_page_image",
  description:
    "See a page of the document as the user sees it when printed, as a picture. Without page: the page with the " +
    "selection (page 1 when Word cannot tell). It shows layout and design: spacing, page breaks, tables, " +
    "pictures, headers and footers.",
  requires: { set: "PdfFile", version: "1.1" },
  parameters: {
    type: "object",
    properties: { page: { type: "integer", minimum: 1, description: "1-based page number." } },
    additionalProperties: false,
  },
  handler: async (args, signal) => {
    const page = optionalInteger(args, "page") ?? (await selectionPage(signal));
    const pdf = await exportPdf();
    const rendered = await renderPdfPage(pdf, page);
    return new ToolResultWithImages({ page, pages: rendered.pages }, [
      { mediaType: "image/png", base64: rendered.base64 },
    ]);
  },
};

/** The page the selection starts on, when this version of Word can tell; otherwise page 1. */
async function selectionPage(signal: AbortSignal): Promise<number> {
  if (!Office.context.requirements.isSetSupported("WordApiDesktop", "1.2")) {
    return 1;
  }
  return runWord(signal, async (context) => {
    const first = context.document.getSelection().pages.getFirst().load("index");
    await context.sync();
    return first.index;
  });
}
