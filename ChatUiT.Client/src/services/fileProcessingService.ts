import i18n from 'i18next';
import type { ChatFile } from '../types/fileModels';
import {
    getFileExtension,
    getSupportedImportKind,
    isImageImportFile,
    isTextImportFile
} from '../utils/fileUtils';
import { track } from './telemetryService';

// Rethrows a failed processor chunk load as an app-updated message.
async function loadProcessor<T>(load: () => Promise<T>): Promise<T> {
    try {
        return await load();
    } catch (error) {
        throw new Error(i18n.t('files.appUpdated'), { cause: error });
    }
}

/** The processors of the complex file types, by extension. */
const complexProcessors = new Map<string, (file: File) => Promise<ChatFile>>([
    ['pdf', async file => (await loadProcessor(() => import('../import/pdfImportProcessor'))).processPdfImport(file)],
    ['docx', async file => (await loadProcessor(() => import('../import/docxImportProcessor'))).processDocxImport(file)],
    ['pptx', async file => (await loadProcessor(() => import('../import/pptxImportProcessor'))).processPptxImport(file)],
    ['xlsx', async file => (await loadProcessor(() => import('../import/xlsxImportProcessor'))).processXlsxImport(file)],
]);

export class FileProcessingService {
    /** The name of the processor that imports the file: image, text, pdf, docx, pptx, xlsx or unsupported. */
    static processorFor(file: File): string {
        const kind = getSupportedImportKind(file);
        if (kind === 'image' || kind === 'text') {
            return kind;
        }
        const extension = getFileExtension(file.name);
        return kind === 'complex' && complexProcessors.has(extension) ? extension : 'unsupported';
    }

    /** Imports the file and records client.file_imported. */
    static async processFile(file: File): Promise<ChatFile> {
        const started = performance.now();
        const record = (outcome: 'succeeded' | 'failed') => track('client.file_imported', {
            'file.name': file.name,
            'file.type': getFileExtension(file.name),
            'file.bytes': file.size,
            processor: FileProcessingService.processorFor(file),
            duration_ms: Math.round(performance.now() - started),
            outcome,
        });

        try {
            const result = await FileProcessingService.importFile(file);
            record('succeeded');
            return result;
        } catch (error) {
            record('failed');
            throw error;
        }
    }

    // Processors are imported on first use: pdfjs, exceljs and jszip are
    // large and only needed once the user attaches a file.
    private static async importFile(file: File): Promise<ChatFile> {
        const kind = getSupportedImportKind(file);

        if (kind === 'image') {
            const { processImageImport } = await loadProcessor(() => import('../import/imageImportProcessor'));
            return processImageImport(file);
        }

        if (kind === 'text') {
            const extension = getFileExtension(file.name);
            const { processTextImport } = await loadProcessor(() => import('../import/textImportProcessor'));
            return processTextImport(file, extension === 'md' || extension === 'markdown' ? 'markdown' : 'plain');
        }

        const complexProcessor = kind === 'complex' ? complexProcessors.get(getFileExtension(file.name)) : undefined;
        if (complexProcessor) {
            return complexProcessor(file);
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

