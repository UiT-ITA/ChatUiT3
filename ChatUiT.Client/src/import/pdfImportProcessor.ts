import * as pdfjs from 'pdfjs-dist';
import type { PDFPageProxy } from 'pdfjs-dist';
import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';
import type { ChatFile, ChatFileChunk } from '../types/fileModels';
import {
    createChatFile,
    createTextChunk,
    normalizeImageDataToChunk
} from './processingShared';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

// The display intent yields through requestAnimationFrame, which never fires while the
// document is hidden and stalls the render. The print intent runs to completion.
const RENDER_INTENT = 'print';
const RENDER_SHORT_SIDE = 1024;
const RENDER_MAX_LONG_SIDE = 2048;
const MIN_IMAGE_PAGE_AREA_FRACTION = 0.05;
const MIN_REPEAT_DETECTION_PAGES = 3;
const MIN_CONTENT_PATH_COUNT = 10;
const MAX_SIMPLE_PATH_SEGMENTS = 5;

type LayoutText = {
    x: number;
    y: number;
    text: string;
};

type PageImage = {
    key: string;
    areaFraction: number;
};

type PageScan = {
    textElements: LayoutText[];
    images: PageImage[];
    pathKeys: string[];
};

export async function processPdfImport(file: File): Promise<ChatFile> {
    const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
    try {
        const pdfDocument = await loadingTask.promise;
        const pageCount = pdfDocument.numPages;
        const scans: PageScan[] = [];

        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
            const page = await pdfDocument.getPage(pageNumber);
            scans.push(await scanPage(page));
        }

        const repeatedKeys = findRepeatedKeys(scans, pageCount);
        const chunks: ChatFileChunk[] = [];

        for (let index = 0; index < pageCount; index += 1) {
            const scan = scans[index];
            const text = scan.textElements.map((element) => element.text).join('\n').trim();
            if (text.length > 0) {
                chunks.push(createTextChunk(`${text}\n\n`, 'plain'));
            }

            if (pageNeedsRender(scan, repeatedKeys)) {
                const page = await pdfDocument.getPage(index + 1);
                const chunk = await renderPageToChunk(page);
                if (chunk) {
                    chunks.push(chunk);
                }
            }
        }

        return createChatFile(file.name, chunks);
    } finally {
        await loadingTask.destroy();
    }
}

async function scanPage(page: PDFPageProxy): Promise<PageScan> {
    const textContent = await page.getTextContent();
    const operatorList = await page.getOperatorList({ intent: RENDER_INTENT });
    const [, , pageWidth, pageHeight] = page.view;
    const pageArea = Math.abs(pageWidth * pageHeight) || 1;

    const images: PageImage[] = [];
    const pathKeys: string[] = [];
    const stateStack: number[][] = [];
    let transform = [1, 0, 0, 1, 0, 0];
    let fillColor = '';

    for (let index = 0; index < operatorList.fnArray.length; index += 1) {
        const fn = operatorList.fnArray[index];
        const args = operatorList.argsArray[index];

        switch (fn) {
            case pdfjs.OPS.save:
                stateStack.push([...transform]);
                break;
            case pdfjs.OPS.restore:
                transform = stateStack.pop() ?? [1, 0, 0, 1, 0, 0];
                break;
            case pdfjs.OPS.transform:
                transform = multiplyTransforms(transform, args as number[]);
                break;
            case pdfjs.OPS.paintFormXObjectBegin:
                stateStack.push([...transform]);
                if (Array.isArray(args?.[0])) {
                    transform = multiplyTransforms(transform, args[0] as number[]);
                }
                break;
            case pdfjs.OPS.paintFormXObjectEnd:
                transform = stateStack.pop() ?? [1, 0, 0, 1, 0, 0];
                break;
            case pdfjs.OPS.setFillRGBColor:
                fillColor = String(args?.[0] ?? '');
                break;
            case pdfjs.OPS.paintImageXObject:
            case pdfjs.OPS.paintInlineImageXObject:
            case pdfjs.OPS.paintImageMaskXObject: {
                const drawnWidth = Math.hypot(transform[0], transform[1]);
                const drawnHeight = Math.hypot(transform[2], transform[3]);
                images.push({
                    key: `image:${roundedKey([drawnWidth, drawnHeight, transform[4], transform[5]])}`,
                    areaFraction: (drawnWidth * drawnHeight) / pageArea
                });
                break;
            }
            case pdfjs.OPS.constructPath: {
                const paintOp = Number(args?.[0]);
                if (paintOp === pdfjs.OPS.endPath || !isComplexPath(args?.[1] as ArrayLike<number> | undefined)) {
                    break;
                }

                const minMax = Array.from((args?.[2] ?? []) as ArrayLike<number>);
                pathKeys.push(`path:${paintOp}:${fillColor}:${roundedKey([...transform, ...minMax])}`);
                break;
            }
            default:
                break;
        }
    }

    return {
        textElements: buildPdfTextLayout(textContent.items),
        images,
        pathKeys
    };
}

function findRepeatedKeys(scans: PageScan[], pageCount: number): Set<string> {
    const repeated = new Set<string>();
    if (pageCount < MIN_REPEAT_DETECTION_PAGES) {
        return repeated;
    }

    const pagesPerKey = new Map<string, number>();
    for (const scan of scans) {
        const keysOnPage = new Set<string>([
            ...scan.images.map((image) => image.key),
            ...scan.pathKeys
        ]);
        for (const key of keysOnPage) {
            pagesPerKey.set(key, (pagesPerKey.get(key) ?? 0) + 1);
        }
    }

    for (const [key, count] of pagesPerKey) {
        if (count > pageCount / 2) {
            repeated.add(key);
        }
    }

    return repeated;
}

function pageNeedsRender(scan: PageScan, repeatedKeys: Set<string>): boolean {
    if (scan.textElements.length === 0) {
        return true;
    }

    const hasContentImage = scan.images.some((image) => {
        return !repeatedKeys.has(image.key) && image.areaFraction >= MIN_IMAGE_PAGE_AREA_FRACTION;
    });
    if (hasContentImage) {
        return true;
    }

    const contentPathCount = scan.pathKeys.filter((key) => !repeatedKeys.has(key)).length;
    return contentPathCount >= MIN_CONTENT_PATH_COUNT;
}

async function renderPageToChunk(page: PDFPageProxy): Promise<ChatFileChunk | null> {
    const baseViewport = page.getViewport({ scale: 1 });
    const shortSide = Math.min(baseViewport.width, baseViewport.height);
    const longSide = Math.max(baseViewport.width, baseViewport.height);
    const scale = Math.min(RENDER_SHORT_SIDE / shortSide, RENDER_MAX_LONG_SIDE / longSide);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Failed to get canvas context');
    }

    await page.render({ canvas, viewport, intent: RENDER_INTENT }).promise;
    return normalizeImageDataToChunk(context.getImageData(0, 0, canvas.width, canvas.height));
}

function buildPdfTextLayout(items: Array<TextItem | TextMarkedContent>): LayoutText[] {
    const groups = new Map<string, TextItem[]>();

    for (const item of items) {
        if (!('str' in item)) {
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
            x: sorted[0]?.transform?.[4] ?? 0,
            y: Number(y),
            text: sorted.map((item) => item.str).join(' ').trim()
        };
    }).filter((item) => item.text.length > 0).sort((left, right) => {
        if (Math.abs(left.y - right.y) > 4) {
            return right.y - left.y;
        }

        return left.x - right.x;
    });
}

// Path data is a flat list of draw ops followed by their coordinates:
// moveTo (2 coords), lineTo (2), curveTo (6), quadraticCurveTo (4), closePath (0).
// Rectangles, rules and table borders are a few straight segments and are ignored.
function isComplexPath(pathData: ArrayLike<number> | undefined): boolean {
    if (!pathData) {
        return false;
    }

    const coordCounts: Record<number, number> = { 0: 2, 1: 2, 2: 6, 3: 4, 4: 0 };
    let segments = 0;
    let index = 0;
    while (index < pathData.length) {
        const op = pathData[index];
        if (op === 2 || op === 3) {
            return true;
        }

        segments += 1;
        if (segments > MAX_SIMPLE_PATH_SEGMENTS) {
            return true;
        }

        index += 1 + (coordCounts[op] ?? 0);
    }

    return false;
}

function roundedKey(values: number[]): string {
    return values.map((value) => Math.round(value * 10) / 10).join(',');
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
