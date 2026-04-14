export interface ChatFile {
    id: string;
    sourceFilename: string;
    chunks: ChatFileChunk[];
}

export interface TextChunk {
    type: 'text';
    text: string;
    format: 'plain' | 'markdown';
}

export interface ImageChunk {
    type: 'image';
    base64: string;
    width: number;
    height: number;
}

export type ChatFileChunk = TextChunk | ImageChunk;
