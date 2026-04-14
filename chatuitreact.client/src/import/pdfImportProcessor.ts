import * as pdfjs from 'pdfjs-dist';
import type { OPS } from 'pdfjs-dist';
import type { ChatFile, ChatFileChunk } from '../types/fileModels';
import {
    createChatFile,
    createTextChunk,
    normalizeImageDataToChunk,
    normalizeImageBytesToChunk
} from './processingShared';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

type LayoutText = {
    kind: 'text';
    x: number;
    y: number;
    text: string;
};

type LayoutImage = {
    kind: 'image';
    x: number;
    y: number;
    chunk: ChatFileChunk;
};

type GraphicsState = {
    transform: number[];
};

export async function processPdfImport(file: File): Promise<ChatFile> {
    const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
    try {
        const pdfDocument = await loadingTask.promise;
        const chunks: ChatFileChunk[] = [];

        for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
            const page = await pdfDocument.getPage(pageNumber);
            const textContent = await page.getTextContent();
            const operatorList = await page.getOperatorList();
            const imageElements = await extractPdfImages(page as any, operatorList as any);
            const textElements = buildPdfTextLayout(textContent.items as Array<any>);

            const ordered = [...textElements, ...imageElements].sort((left, right) => {
                if (Math.abs(left.y - right.y) > 4) {
                    return right.y - left.y;
                }

                return left.x - right.x;
            });

            let textBuffer = '';
            const flushText = () => {
                const normalized = textBuffer.trim();
                textBuffer = '';
                if (normalized.length > 0) {
                    chunks.push(createTextChunk(`${normalized}\n\n`, 'plain'));
                }
            };

            for (const element of ordered) {
                if (element.kind === 'text') {
                    textBuffer += `${element.text}\n`;
                    continue;
                }

                flushText();
                chunks.push(element.chunk);
            }

            flushText();
        }

        return createChatFile(file.name, chunks);
    } finally {
        await loadingTask.destroy();
    }
}

async function extractPdfImages(page: any, operatorList: any): Promise<LayoutImage[]> {
    const layoutImages: LayoutImage[] = [];
    const stateStack: GraphicsState[] = [];
    let state: GraphicsState = { transform: [1, 0, 0, 1, 0, 0] };

    for (let index = 0; index < operatorList.fnArray.length; index += 1) {
        const fn = operatorList.fnArray[index];
        const args = operatorList.argsArray[index];

        if (fn === (pdfjs.OPS as typeof OPS).save) {
            stateStack.push({ transform: [...state.transform] });
            continue;
        }

        if (fn === (pdfjs.OPS as typeof OPS).restore) {
            state = stateStack.pop() ?? { transform: [1, 0, 0, 1, 0, 0] };
            continue;
        }

        if (fn === (pdfjs.OPS as typeof OPS).transform) {
            state.transform = multiplyTransforms(state.transform, args as number[]);
            continue;
        }

        if (fn === (pdfjs.OPS as typeof OPS).paintImageXObject) {
            const imageName = args[0];
            const imageObject = await getPdfImageObject(page, imageName);
            if (!imageObject) {
                throw new Error('PDF image extraction is unsupported for this file');
            }

            const chunk = await convertPdfImageObjectToChunk(imageObject);
            layoutImages.push({
                kind: 'image',
                x: state.transform[4] ?? 0,
                y: state.transform[5] ?? 0,
                chunk
            });
            continue;
        }

        if (fn === (pdfjs.OPS as typeof OPS).paintInlineImageXObject) {
            const inlineImage = args[0];
            if (!inlineImage) {
                continue;
            }

            const chunk = await convertPdfImageObjectToChunk(inlineImage);
            layoutImages.push({
                kind: 'image',
                x: state.transform[4] ?? 0,
                y: state.transform[5] ?? 0,
                chunk
            });
        }
    }

    return layoutImages;
}

function buildPdfTextLayout(items: Array<any>): LayoutText[] {
    const groups = new Map<string, Array<any>>();

    for (const item of items) {
        if (!('str' in item) || typeof item.str !== 'string') {
            continue;
        }

        const y = Math.round(item.transform?.[5] ?? 0);
        const key = String(y);
        const group = groups.get(key) ?? [];
        group.push(item);
        groups.set(key, group);
    }

    return Array.from(groups.entries()).map(([y, group]) => {
        const sorted = group.sort((left, right) => (left.transform?.[4] ?? 0) - (right.transform?.[4] ?? 0));
        return {
            kind: 'text' as const,
            x: sorted[0]?.transform?.[4] ?? 0,
            y: Number(y),
            text: sorted.map((item) => item.str).join(' ').trim()
        };
    }).filter((item) => item.text.length > 0);
}

async function getPdfImageObject(page: any, name: string): Promise<any> {
    return new Promise((resolve) => {
        let settled = false;
        const timeoutId = window.setTimeout(() => {
            if (!settled) {
                settled = true;
                resolve(null);
            }
        }, 1500);

        const finish = (value: any) => {
            if (settled) {
                return;
            }

            settled = true;
            window.clearTimeout(timeoutId);
            resolve(value);
        };

        try {
            const existing = page.objs.get(name);
            if (existing) {
                finish(existing);
                return;
            }
        } catch {
            // Ignore and fall through to callback access.
        }

        try {
            page.objs.get(name, (value: any) => finish(value));
        } catch {
            finish(null);
        }
    });
}

async function convertPdfImageObjectToChunk(imageObject: any): Promise<ChatFileChunk> {
    if (imageObject instanceof ImageData) {
        return normalizeImageDataToChunk(imageObject);
    }

    if (imageObject?.bitmap) {
        const canvas = document.createElement('canvas');
        canvas.width = imageObject.bitmap.width;
        canvas.height = imageObject.bitmap.height;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Failed to get canvas context');
        }

        context.drawImage(imageObject.bitmap, 0, 0);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        return normalizeImageDataToChunk(imageData);
    }

    if (imageObject?.data && imageObject?.width && imageObject?.height) {
        return normalizeImageDataToChunk(new ImageData(new Uint8ClampedArray(imageObject.data), imageObject.width, imageObject.height));
    }

    if (imageObject?.src && typeof imageObject.src === 'string') {
        const response = await fetch(imageObject.src);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const mimeType = response.headers.get('content-type') ?? 'image/jpeg';
        return normalizeImageBytesToChunk(bytes, mimeType);
    }

    throw new Error('PDF image extraction is unsupported for this file');
}

function multiplyTransforms(left: number[], right: number[]): number[] {
    return [
        left[0] * right[0] + left[2] * right[1],
        left[1] * right[0] + left[3] * right[1],
        left[0] * right[2] + left[2] * right[3],
        left[1] * right[2] + left[3] * right[3],
        left[0] * right[4] + left[2] * right[5] + left[4],
        left[1] * right[4] + left[3] * right[5] + left[5]
    ];
}
