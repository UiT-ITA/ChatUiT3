import type { ProcessedFile } from '../types/importModels';
import { createProcessedFile, createTextChunk, readFileAsText } from './processingShared';

export async function processTextImport(file: File, format: 'plain' | 'markdown'): Promise<ProcessedFile> {
    const text = await readFileAsText(file);
    return createProcessedFile(file.name, [createTextChunk(text, format)]);
}