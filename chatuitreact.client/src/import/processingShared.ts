import type { ImageChunk, ChatFile, ChatFileChunk, TextChunk } from '../types/fileModels';

const MAX_LONG_SIDE = 2048;
const MAX_SHORT_SIDE = 1024;
const JPEG_QUALITY = 0.85;

export function createChatFile(sourceFilename: string, chunks: ChatFileChunk[]): ChatFile {
    return {
        id: crypto.randomUUID(),
        sourceFilename,
        chunks: mergeAdjacentTextChunks(chunks).filter((chunk) => {
            return chunk.type === 'image' || chunk.text.length > 0;
        })
    };
}

export function createTextChunk(text: string, format: 'plain' | 'markdown'): TextChunk {
    return {
        type: 'text',
        text,
        format
    };
}

export async function normalizeImageFileToChunk(file: File): Promise<ImageChunk | null> {
    return normalizeImageBlobToChunk(file);
}

export async function normalizeImageBlobToChunk(blob: Blob): Promise<ImageChunk | null> {
    const dataUrl = await blobToDataUrl(blob);
    return normalizeImageDataUrlToChunk(dataUrl);
}

export async function normalizeImageBytesToChunk(bytes: Uint8Array | ArrayBuffer, mimeType: string): Promise<ImageChunk | null> {
    const byteCopy = bytes instanceof Uint8Array
        ? new Uint8Array(bytes)
        : new Uint8Array(bytes.slice(0));

    return normalizeImageBlobToChunk(new Blob([byteCopy.buffer], { type: mimeType }));
}

export async function normalizeImageDataToChunk(imageData: ImageData): Promise<ImageChunk | null> {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;

    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Failed to get canvas context');
    }

    context.putImageData(imageData, 0, 0);
    const blob = await canvasToBlob(canvas, 'image/png');
    return normalizeImageBlobToChunk(blob);
}

export async function readFileAsText(file: File): Promise<string> {
    return file.text();
}

export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return file.arrayBuffer();
}

export function toJpegDataUrl(base64: string): string {
    return `data:image/jpeg;base64,${base64}`;
}

export function escapeMarkdownTableCell(value: string): string {
    return value.replace(/\|/g, '\\|').replace(/\n/g, '<br/>');
}

export function collectElementText(element: Element): string {
    const textParts: string[] = [];

    const visit = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const value = node.textContent ?? '';
            if (value.length > 0) {
                textParts.push(value);
            }
            return;
        }

        if (!(node instanceof Element)) {
            return;
        }

        if (node.localName === 'tab') {
            textParts.push('\t');
            return;
        }

        if (node.localName === 'br') {
            textParts.push('\n');
            return;
        }

        Array.from(node.childNodes).forEach(visit);
    };

    visit(element);

    return textParts.join('');
}

export function resolveZipPath(basePath: string, target: string): string {
    const baseSegments = basePath.split('/').filter(Boolean);
    baseSegments.pop();

    const targetSegments = target.split('/');
    for (const segment of targetSegments) {
        if (!segment || segment === '.') {
            continue;
        }

        if (segment === '..') {
            baseSegments.pop();
            continue;
        }

        baseSegments.push(segment);
    }

    return baseSegments.join('/');
}

export function parseXmlDocument(xml: string): Document {
    return new DOMParser().parseFromString(xml, 'application/xml');
}

export function getRelationshipTargets(relsXml: string, relsPath: string): Map<string, string> {
    const relationships = new Map<string, string>();
    const relsDocument = parseXmlDocument(relsXml);

    Array.from(relsDocument.getElementsByTagName('*')).forEach((node) => {
        if (!(node instanceof Element) || node.localName !== 'Relationship') {
            return;
        }

        const id = node.getAttribute('Id');
        const target = node.getAttribute('Target');

        if (!id || !target) {
            return;
        }

        relationships.set(id, resolveZipPath(relsPath, target));
    });

    return relationships;
}

function mergeAdjacentTextChunks(chunks: ChatFileChunk[]): ChatFileChunk[] {
    const merged: ChatFileChunk[] = [];

    for (const chunk of chunks) {
        if (chunk.type === 'text' && chunk.text.length === 0) {
            continue;
        }

        const previous = merged[merged.length - 1];
        if (
            previous?.type === 'text' &&
            chunk.type === 'text' &&
            previous.format === chunk.format
        ) {
            previous.text += chunk.text;
            continue;
        }

        merged.push(chunk);
    }

    return merged;
}

async function normalizeImageDataUrlToChunk(dataUrl: string): Promise<ImageChunk | null> {
    const image = await loadImage(dataUrl);

    if (image.width < 100 || image.height < 100) {
        return null;
    }

    const { width, height } = calculateImageDimensions(image.width, image.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Failed to get canvas context');
    }

    context.drawImage(image, 0, 0, width, height);
    const jpegDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    const base64 = jpegDataUrl.split(',')[1];

    return {
        type: 'image',
        base64
    };
}

function calculateImageDimensions(originalWidth: number, originalHeight: number): { width: number; height: number } {
    const isLandscape = originalWidth > originalHeight;
    let targetWidth = originalWidth;
    let targetHeight = originalHeight;

    if (isLandscape) {
        if (originalWidth > MAX_LONG_SIDE) {
            const ratio = MAX_LONG_SIDE / originalWidth;
            targetWidth = MAX_LONG_SIDE;
            targetHeight = originalHeight * ratio;
        }

        if (targetHeight > MAX_SHORT_SIDE) {
            const ratio = MAX_SHORT_SIDE / targetHeight;
            targetHeight = MAX_SHORT_SIDE;
            targetWidth *= ratio;
        }
    } else {
        if (originalHeight > MAX_LONG_SIDE) {
            const ratio = MAX_LONG_SIDE / originalHeight;
            targetHeight = MAX_LONG_SIDE;
            targetWidth = originalWidth * ratio;
        }

        if (targetWidth > MAX_SHORT_SIDE) {
            const ratio = MAX_SHORT_SIDE / targetWidth;
            targetWidth = MAX_SHORT_SIDE;
            targetHeight *= ratio;
        }
    }

    return {
        width: Math.round(targetWidth),
        height: Math.round(targetHeight)
    };
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load image'));
        image.src = src;
    });
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
        reader.readAsDataURL(blob);
    });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Failed to create blob from canvas'));
                return;
            }

            resolve(blob);
        }, type);
    });
}
