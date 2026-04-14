export const getFileExtension = (filename: string): string => {
    const lastDot = filename.lastIndexOf('.');
    return lastDot === -1 ? '' : filename.slice(lastDot + 1).toLowerCase();
};

export const SUPPORTED_IMAGE_IMPORT_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/bmp',
    'image/webp',
    'image/gif'
] as const;

export const SUPPORTED_TEXT_IMPORT_MIME_TYPES = [
    'text/plain',
    'text/csv',
    'application/json',
    'text/markdown'
] as const;

export const SUPPORTED_COMPLEX_IMPORT_EXTENSIONS = ['pdf', 'docx', 'pptx', 'xlsx'] as const;
export const SUPPORTED_TEXT_IMPORT_EXTENSIONS = ['txt', 'csv', 'json', 'md', 'markdown'] as const;

const SUPPORTED_COMPLEX_IMPORT_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
] as const;

export const SUPPORTED_IMPORT_ACCEPT = [
    '.txt',
    '.csv',
    '.json',
    '.md',
    '.markdown',
    '.pdf',
    '.docx',
    '.pptx',
    '.xlsx',
    'image/jpeg',
    'image/png',
    'image/bmp',
    'image/webp',
    'image/gif'
].join(',');

export type SupportedImportKind = 'image' | 'text' | 'complex';

export const getSupportedImportKind = (file: File): SupportedImportKind | null => {
    const extension = getFileExtension(file.name);

    if (SUPPORTED_IMAGE_IMPORT_MIME_TYPES.includes(file.type as typeof SUPPORTED_IMAGE_IMPORT_MIME_TYPES[number])) {
        return 'image';
    }

    if (
        SUPPORTED_TEXT_IMPORT_MIME_TYPES.includes(file.type as typeof SUPPORTED_TEXT_IMPORT_MIME_TYPES[number]) ||
        SUPPORTED_TEXT_IMPORT_EXTENSIONS.includes(extension as typeof SUPPORTED_TEXT_IMPORT_EXTENSIONS[number])
    ) {
        return 'text';
    }

    if (
        SUPPORTED_COMPLEX_IMPORT_MIME_TYPES.includes(file.type as typeof SUPPORTED_COMPLEX_IMPORT_MIME_TYPES[number]) ||
        SUPPORTED_COMPLEX_IMPORT_EXTENSIONS.includes(extension as typeof SUPPORTED_COMPLEX_IMPORT_EXTENSIONS[number])
    ) {
        return 'complex';
    }

    return null;
};

export const isImageImportFile = (file: File): boolean => getSupportedImportKind(file) === 'image';
export const isTextImportFile = (file: File): boolean => getSupportedImportKind(file) === 'text';

export const isValidFileType = (file: File): boolean => {
    return getSupportedImportKind(file) !== null;
};

export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

import type { ChatFile } from '../types/fileModels';
import type { CreateChatFileDto } from '../types/chatModels';

export function mapToCreateChatFileDto(files: ChatFile[]): CreateChatFileDto[] {
    return files.map(file => ({
        sourceFilename: file.sourceFilename,
        chunks: file.chunks.map(chunk => ({
             type: chunk.type,
             text: chunk.type === 'text' ? chunk.text : undefined,
             format: chunk.type === 'text' ? chunk.format : undefined,
             base64: chunk.type === 'image' ? chunk.base64 : undefined,
             width: chunk.type === 'image' ? chunk.width : undefined,
             height: chunk.type === 'image' ? chunk.height : undefined
        }))
    }));
}
