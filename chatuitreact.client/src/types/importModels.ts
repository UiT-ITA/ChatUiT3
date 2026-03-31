export interface ProcessedFile {
    id: string;
    sourceFilename: string;
    chunks: ProcessedFileChunk[];
}

export interface TextChunk {
    id: string;
    type: 'text';
    text: string;
    format: 'plain' | 'markdown';
}

export interface ImageChunk {
    id: string;
    type: 'image';
    base64: string;
    width: number;
    height: number;
}

export type ProcessedFileChunk = TextChunk | ImageChunk;