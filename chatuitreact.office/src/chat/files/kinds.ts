/* global File */

/** The files ChatUiT can read, as in ChatUiT's chat (chatuitreact.client/src/utils/fileUtils.ts). */

export const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf(".");
  return lastDot === -1 ? "" : filename.slice(lastDot + 1).toLowerCase();
};

const SUPPORTED_IMAGE_IMPORT_MIME_TYPES = ["image/jpeg", "image/png", "image/bmp", "image/webp", "image/gif"];
const SUPPORTED_TEXT_IMPORT_MIME_TYPES = ["text/plain", "text/csv", "application/json", "text/markdown"];
const SUPPORTED_COMPLEX_IMPORT_EXTENSIONS = ["pdf", "docx", "pptx", "xlsx"];
const SUPPORTED_TEXT_IMPORT_EXTENSIONS = ["txt", "csv", "json", "md", "markdown"];
const SUPPORTED_COMPLEX_IMPORT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

/** The file picker's accept list. */
export const SUPPORTED_IMPORT_ACCEPT = [
  ...SUPPORTED_TEXT_IMPORT_EXTENSIONS.map((extension) => `.${extension}`),
  ...SUPPORTED_COMPLEX_IMPORT_EXTENSIONS.map((extension) => `.${extension}`),
  ...SUPPORTED_IMAGE_IMPORT_MIME_TYPES,
].join(",");

export type SupportedImportKind = "image" | "text" | "complex";

export const getSupportedImportKind = (file: File): SupportedImportKind | null => {
  const extension = getFileExtension(file.name);
  if (SUPPORTED_IMAGE_IMPORT_MIME_TYPES.includes(file.type)) {
    return "image";
  }
  if (SUPPORTED_TEXT_IMPORT_MIME_TYPES.includes(file.type) || SUPPORTED_TEXT_IMPORT_EXTENSIONS.includes(extension)) {
    return "text";
  }
  if (
    SUPPORTED_COMPLEX_IMPORT_MIME_TYPES.includes(file.type) ||
    SUPPORTED_COMPLEX_IMPORT_EXTENSIONS.includes(extension)
  ) {
    return "complex";
  }
  return null;
};
