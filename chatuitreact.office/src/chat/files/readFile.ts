/* global File */

import type { ChatFile } from "./fileModels";
import { getFileExtension, getSupportedImportKind } from "./kinds";

/**
 * Reads a file into text and image chunks, as ChatUiT's chat does (FileProcessingService). Each reader loads on
 * first use, so pdf.js, JSZip and ExcelJS stay out of the pane's start-up.
 */
export async function readFile(file: File): Promise<ChatFile> {
  const kind = getSupportedImportKind(file);
  const extension = getFileExtension(file.name);

  if (kind === "image") {
    return (await import("./import/imageImportProcessor")).processImageImport(file);
  }
  if (kind === "text") {
    const format = extension === "md" || extension === "markdown" ? "markdown" : "plain";
    return (await import("./import/textImportProcessor")).processTextImport(file, format);
  }
  if (kind === "complex") {
    switch (extension) {
      case "pdf":
        return (await import("./import/pdfImportProcessor")).processPdfImport(file);
      case "docx":
        return (await import("./import/docxImportProcessor")).processDocxImport(file);
      case "pptx":
        return (await import("./import/pptxImportProcessor")).processPptxImport(file);
      case "xlsx":
        return (await import("./import/xlsxImportProcessor")).processXlsxImport(file);
    }
  }
  throw new Error(`Unsupported file type: ${file.type || extension}`);
}
