import type { ChatFile } from '../types/fileModels';
import {
    getFileExtension,
    getSupportedImportKind,
    isImageImportFile,
    isTextImportFile
} from '../utils/fileUtils';

export class FileProcessingService {
    // Processors are imported on first use: pdfjs, exceljs and jszip are
    // large and only needed once the user attaches a file.
    static async processFile(file: File): Promise<ChatFile> {
        const kind = getSupportedImportKind(file);

        if (kind === 'image') {
            const { processImageImport } = await import('../import/imageImportProcessor');
            return processImageImport(file);
        }

        if (kind === 'text') {
            const extension = getFileExtension(file.name);
            const { processTextImport } = await import('../import/textImportProcessor');
            return processTextImport(file, extension === 'md' || extension === 'markdown' ? 'markdown' : 'plain');
        }

        if (kind === 'complex') {
            const extension = getFileExtension(file.name);

            if (extension === 'pdf') {
                const { processPdfImport } = await import('../import/pdfImportProcessor');
                return processPdfImport(file);
            }

            if (extension === 'docx') {
                const { processDocxImport } = await import('../import/docxImportProcessor');
                return processDocxImport(file);
            }

            if (extension === 'pptx') {
                const { processPptxImport } = await import('../import/pptxImportProcessor');
                return processPptxImport(file);
            }

            if (extension === 'xlsx') {
                const { processXlsxImport } = await import('../import/xlsxImportProcessor');
                return processXlsxImport(file);
            }
        }

        throw new Error(`Unsupported file type: ${file.type}`);
    }

    static isImageFile(file: File): boolean {
        return isImageImportFile(file);
    }

    static isTextFile(file: File): boolean {
        return isTextImportFile(file);
    }
}

