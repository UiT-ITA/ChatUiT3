import { processDocxImport } from '../import/docxImportProcessor';
import { processImageImport } from '../import/imageImportProcessor';
import { processPdfImport } from '../import/pdfImportProcessor';
import { processPptxImport } from '../import/pptxImportProcessor';
import { processTextImport } from '../import/textImportProcessor';
import { processXlsxImport } from '../import/xlsxImportProcessor';
import type { ChatFile } from '../types/fileModels';
import {
    getFileExtension,
    getSupportedImportKind,
    isImageImportFile,
    isTextImportFile
} from '../utils/fileUtils';

export class FileProcessingService {
    static async processFile(file: File): Promise<ChatFile> {
        const kind = getSupportedImportKind(file);

        if (kind === 'image') {
            return processImageImport(file);
        }

        if (kind === 'text') {
            const extension = getFileExtension(file.name);
            return processTextImport(file, extension === 'md' || extension === 'markdown' ? 'markdown' : 'plain');
        }

        if (kind === 'complex') {
            const extension = getFileExtension(file.name);

            if (extension === 'pdf') {
                return processPdfImport(file);
            }

            if (extension === 'docx') {
                return processDocxImport(file);
            }

            if (extension === 'pptx') {
                return processPptxImport(file);
            }

            if (extension === 'xlsx') {
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

