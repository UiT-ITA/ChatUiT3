import i18n from 'i18next';
import apiService, { ApiError } from './apiService';
import { errorText, formatError, type ErrorCode } from '../errors/errorCodes';
import type { FilePreviewKind } from '../types/fileModels';
import type { ChatFileDto } from '../types/chatModels';
import { formatFileSize, getFileExtension } from '../utils/fileUtils';

/** The translated text for each file error code the server sends. */
const SERVER_FILE_ERRORS: Record<string, () => string> = {
  E5100: () => i18n.t('files.tooLarge', { limit: formatFileSize(MAX_FILE_BYTES) }),
  E5101: () => i18n.t('files.typeNotSupported'),
  E5102: () => i18n.t('files.uploadFailed'),
  E5104: () => i18n.t('files.uploadFailed'),
  E5105: () => i18n.t('files.uploadFailed'),
  E5130: () => i18n.t('files.errors.messageGone'),
  E4010: () => i18n.t('files.errors.chatGone'),
  E4037: () => i18n.t('files.errors.assistantGone'),
  E5110: () => i18n.t('files.errors.importFailed'),
  E5111: () => i18n.t('files.errors.imageLoadFailed'),
  E5112: () => i18n.t('files.errors.pdfPasswordProtected'),
  E5113: () => i18n.t('files.errors.pdfInvalid'),
  E5114: () => i18n.t('files.errors.docxOpenFailed'),
  E5115: () => i18n.t('files.errors.docxContentMissing'),
  E5116: () => i18n.t('files.errors.pptxOpenFailed'),
  E5117: () => i18n.t('files.errors.xlsxOpenFailed'),
  E5131: () => i18n.t('files.previewNotAvailable'),
  E4033: () => i18n.t('files.errors.alwaysLoadedTooLarge'),
  E4034: () => i18n.t('assistants.knowledge.descriptionRequired'),
};

/**
 * The text shown for a failed file request: the translated text for a file error code from the
 * server, with its code and reference. Any other error shows as errorText gives it.
 */
export function fileErrorText(error: unknown, code: ErrorCode, fallback: string): string {
  const translated = error instanceof ApiError ? SERVER_FILE_ERRORS[error.errorCode] : undefined;
  return translated ? formatError(translated(), (error as ApiError).errorCode, (error as ApiError).ref) : errorText(error, code, fallback);
}

/** The largest file the server accepts. */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

/** Uploads a file to a message that is not sent yet. Resolves once the server has stored and converted it. */
export function uploadMessageFile(chatId: string, messageId: string, file: File, onProgress: (fraction: number) => void): Promise<ChatFileDto> {
  return apiService.uploadFile<ChatFileDto>(`/api/Chats/${chatId}/messages/${messageId}/files`, file, onProgress);
}

// Switched off in stage 1: everything below fetches, saves and classifies a file's original
// for the original-file preview (OriginalFilePreviewModal). Nothing calls it.

/** Where a stored file's original is fetched from. */
export const fileContentEndpoint = (filesEndpoint: string, fileId: string) => `${filesEndpoint}/${fileId}/content`;

// Originals are fetched once and kept as object URLs.
const originals = new Map<string, Promise<Blob>>();

/** The original of a stored file. */
export function fetchOriginal(contentEndpoint: string): Promise<Blob> {
  let pending = originals.get(contentEndpoint);
  if (!pending) {
    pending = apiService.getBlob(contentEndpoint);
    originals.set(contentEndpoint, pending);
    pending.catch(() => originals.delete(contentEndpoint));
  }
  return pending;
}

/** Forgets the fetched originals under an endpoint, such as the files of a deleted chat. */
export function forgetOriginals(filesEndpoint: string): void {
  for (const key of Array.from(originals.keys())) {
    if (key.startsWith(`${filesEndpoint}/`)) originals.delete(key);
  }
}

/** Saves a blob as a file through the browser's download. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const PREVIEW_BY_EXTENSION: Record<string, FilePreviewKind> = {
  pdf: 'pdf',
  jpg: 'image', jpeg: 'image', png: 'image', bmp: 'image', webp: 'image', gif: 'image',
  txt: 'text', csv: 'text', json: 'text',
  md: 'markdown', markdown: 'markdown',
  docx: 'download', pptx: 'download', xlsx: 'download',
};

/** How a file that is not uploaded yet is shown. Mirrors FilePreviews.KindOf on the server. */
export function previewKindOf(file: File): FilePreviewKind {
  const byExtension = PREVIEW_BY_EXTENSION[getFileExtension(file.name)];
  if (byExtension) return byExtension;
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'text/markdown') return 'markdown';
  return file.type.startsWith('text/') || file.type === 'application/json' ? 'text' : 'download';
}
