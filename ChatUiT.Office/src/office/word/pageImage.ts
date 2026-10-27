/* global document, Office, URL */

import { callAsync } from "../shared/callAsync";
import { MAX_IMAGE_EDGE } from "../shared/image";

const SLICE_SIZE = 4 * 1024 * 1024;

/** The whole document as a PDF, laid out as Word prints it. Word has no API for a picture of a page. */
export async function exportPdf(): Promise<Uint8Array> {
  const file = await callAsync<Office.File>((callback) =>
    Office.context.document.getFileAsync(Office.FileType.Pdf, { sliceSize: SLICE_SIZE }, callback)
  );
  try {
    const slices: Uint8Array[] = [];
    for (let index = 0; index < file.sliceCount; index++) {
      const slice = await callAsync<Office.Slice>((callback) => file.getSliceAsync(index, callback));
      slices.push(new Uint8Array(slice.data as ArrayLike<number>));
    }
    const bytes = new Uint8Array(slices.reduce((total, slice) => total + slice.length, 0));
    let offset = 0;
    for (const slice of slices) {
      bytes.set(slice, offset);
      offset += slice.length;
    }
    return bytes;
  } finally {
    // Word keeps one exported file open at a time, so it is always closed.
    await callAsync<void>((callback) => file.closeAsync(callback));
  }
}

/** Renders one page of a PDF as a PNG whose longest edge is MAX_IMAGE_EDGE pixels. pdf.js loads on first use. */
export async function renderPdfPage(pdf: Uint8Array, pageNumber: number): Promise<{ base64: string; pages: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).href;
  const loaded = await pdfjs.getDocument({ data: pdf }).promise;
  try {
    if (pageNumber < 1 || pageNumber > loaded.numPages) {
      throw new Error(`The document has ${loaded.numPages} pages; page ${pageNumber} does not exist.`);
    }
    const page = await loaded.getPage(pageNumber);
    const size = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: MAX_IMAGE_EDGE / Math.max(size.width, size.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("The page could not be drawn: no canvas.");
    }
    await page.render({ canvasContext: context, viewport }).promise;
    return { base64: canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, ""), pages: loaded.numPages };
  } finally {
    await loaded.destroy();
  }
}
