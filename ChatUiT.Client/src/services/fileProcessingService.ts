import i18n from 'i18next';
import type { ChatFile } from '../types/fileModels';
import {
    getFileExtension,
    getSupportedImportKind,
    isImageImportFile,
    isTextImportFile
} from '../utils/fileUtils';
import { track, trackError } from './telemetryService';
import { addNotification } from './notificationService';
import { CodedError, ErrorCode, errorText } from '../errors/errorCodes';

// Rethrows a failed processor chunk load as an app-updated message.
async function loadProcessor<T>(load: () => Promise<T>): Promise<T> {
    try {
        return await load();
    } catch (error) {
        throw new CodedError(ErrorCode.AppUpdated, i18n.t('files.appUpdated'), undefined, { cause: error });
    }
}

/** The code and text for an import failure without its own code, by processor. */
const importFailures: Record<string, { code: ErrorCode; key: string }> = {
    image: { code: ErrorCode.ImageImportFailed, key: 'files.errors.imageFailed' },
    text: { code: ErrorCode.TextImportFailed, key: 'files.errors.textFailed' },
    pdf: { code: ErrorCode.PdfImportFailed, key: 'files.errors.pdfFailed' },
    docx: { code: ErrorCode.DocxImportFailed, key: 'files.errors.docxFailed' },
    pptx: { code: ErrorCode.PptxImportFailed, key: 'files.errors.pptxFailed' },
    xlsx: { code: ErrorCode.XlsxImportFailed, key: 'files.errors.xlsxFailed' },
};

// Rethrows an error without a code as the processor's import failure.
async function withImportFailure<T>(processor: string, run: () => Promise<T>): Promise<T> {
    try {
        return await run();
    } catch (error) {
        const failure = importFailures[processor];
        if (error instanceof CodedError || !failure) {
            throw error;
        }
        throw new CodedError(failure.code, i18n.t(failure.key), undefined, { cause: error });
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
    /** Processes the files and returns the ones that worked. Each failure is logged, tracked with this message and shown as an error. */
    static async importFiles(files: File[], failureMessage: string): Promise<ChatFile[]> {
        const results = await Promise.allSettled(files.map((file) => this.processFile(file)));
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') return;
            const file = files[index];
            const reason = errorText(result.reason, ErrorCode.ImportFailed, i18n.t('files.errors.importFailed'));
            console.error(`Failed to process file ${file.name}:`, result.reason);
            trackError('file_import', {
                message: failureMessage,
                error: result.reason,
                extra: {
                    'file.name': file.name,
                    'file.type': getFileExtension(file.name),
                    'file.bytes': file.size,
                    processor: this.processorFor(file),
                },
            });
            addNotification({ level: 'Error', message: `${file.name}: ${reason}` });
        });
        return results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
    }

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
            const result = await withImportFailure(FileProcessingService.processorFor(file), () => FileProcessingService.importFile(file));
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

        throw new CodedError(ErrorCode.NoImportProcessor, i18n.t('files.errors.noProcessor'));
    }

    static isImageFile(file: File): boolean {
        return isImageImportFile(file);
    }

    static isTextFile(file: File): boolean {
        return isTextImportFile(file);
    }
}

