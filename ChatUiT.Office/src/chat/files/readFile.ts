/* global File, performance */

import type { ChatFile } from "./fileModels";
import { getFileExtension, getSupportedImportKind } from "./kinds";
import { track } from "../telemetry/telemetryService";

/** Rethrows a failed reader chunk load as an app-updated message. */
async function loadReader<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    throw new Error("a new version of ChatUiT is available. Reopen the pane and try again.", { cause: error });
  }
}

/** The readers of the complex file types, by extension. */
const complexReaders = new Map<string, (file: File) => Promise<ChatFile>>([
  ["pdf", async (file) => (await loadReader(() => import("./import/pdfImportProcessor"))).processPdfImport(file)],
  ["docx", async (file) => (await loadReader(() => import("./import/docxImportProcessor"))).processDocxImport(file)],
  ["pptx", async (file) => (await loadReader(() => import("./import/pptxImportProcessor"))).processPptxImport(file)],
  ["xlsx", async (file) => (await loadReader(() => import("./import/xlsxImportProcessor"))).processXlsxImport(file)],
]);

/** The name of the reader that imports the file: image, text, pdf, docx, pptx, xlsx or unsupported. */
export function processorFor(file: File): string {
  const kind = getSupportedImportKind(file);
  if (kind === "image" || kind === "text") {
    return kind;
  }
  const extension = getFileExtension(file.name);
  return kind === "complex" && complexReaders.has(extension) ? extension : "unsupported";
}

/** Reads the file and records client.file_imported. */
export async function readFile(file: File): Promise<ChatFile> {
  const started = performance.now();
  const record = (outcome: "succeeded" | "failed") =>
    track("client.file_imported", {
      "file.name": file.name,
      "file.type": getFileExtension(file.name),
      "file.bytes": file.size,
      processor: processorFor(file),
      duration_ms: Math.round(performance.now() - started),
      outcome,
    });

  try {
    const result = await importFile(file);
    record("succeeded");
    return result;
  } catch (error) {
    record("failed");
    throw error;
  }
}

/**
 * Reads a file into text and image chunks, as ChatUiT's chat does (FileProcessingService). Each reader loads on
 * first use, so pdf.js, JSZip and ExcelJS stay out of the pane's start-up.
 */
async function importFile(file: File): Promise<ChatFile> {
  const kind = getSupportedImportKind(file);
  const extension = getFileExtension(file.name);

  if (kind === "image") {
    return (await loadReader(() => import("./import/imageImportProcessor"))).processImageImport(file);
  }
  if (kind === "text") {
    const format = extension === "md" || extension === "markdown" ? "markdown" : "plain";
    return (await loadReader(() => import("./import/textImportProcessor"))).processTextImport(file, format);
  }
  const complexReader = kind === "complex" ? complexReaders.get(extension) : undefined;
  if (complexReader) {
    return complexReader(file);
  }
  throw new Error(`Unsupported file type: ${file.type || extension}`);
}
