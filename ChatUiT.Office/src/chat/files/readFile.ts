/* global File */

import type { ChatFile } from "./fileModels";
import { getFileExtension, getSupportedImportKind } from "./kinds";

/** Rethrows a failed reader chunk load as an app-updated message. */
async function loadReader<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    throw new Error("a new version of ChatUiT is available. Reopen the pane and try again.", { cause: error });
  }
}

/**
 * Reads a file into text and image chunks, as ChatUiT's chat does (FileProcessingService). Each reader loads on
 * first use, so pdf.js, JSZip and ExcelJS stay out of the pane's start-up.
 */
export async function readFile(file: File): Promise<ChatFile> {
  const kind = getSupportedImportKind(file);
  const extension = getFileExtension(file.name);

  if (kind === "image") {
    return (await loadReader(() => import("./import/imageImportProcessor"))).processImageImport(file);
  }
  if (kind === "text") {
    const format = extension === "md" || extension === "markdown" ? "markdown" : "plain";
    return (await loadReader(() => import("./import/textImportProcessor"))).processTextImport(file, format);
  }
  if (kind === "complex") {
    switch (extension) {
      case "pdf":
        return (await loadReader(() => import("./import/pdfImportProcessor"))).processPdfImport(file);
      case "docx":
        return (await loadReader(() => import("./import/docxImportProcessor"))).processDocxImport(file);
      case "pptx":
        return (await loadReader(() => import("./import/pptxImportProcessor"))).processPptxImport(file);
      case "xlsx":
        return (await loadReader(() => import("./import/xlsxImportProcessor"))).processXlsxImport(file);
    }
  }
  throw new Error(`Unsupported file type: ${file.type || extension}`);
}
