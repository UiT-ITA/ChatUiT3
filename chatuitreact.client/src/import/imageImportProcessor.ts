import type { ProcessedFile } from '../types/importModels';
import { createProcessedFile, normalizeImageFileToChunk } from './processingShared';

export async function processImageImport(file: File): Promise<ProcessedFile> {
    const chunk = await normalizeImageFileToChunk(file);
    return createProcessedFile(file.name, [chunk]);
}