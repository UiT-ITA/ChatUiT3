import ExcelJS from 'exceljs';
import type { ChatFile, ChatFileChunk } from '../types/fileModels';
import {
    createChatFile,
    createTextChunk,
    escapeMarkdownTableCell,
    normalizeImageBytesToChunk
} from './processingShared';

type WorksheetImage = {
    imageId: number;
    row: number;
    col: number;
};

export async function processXlsxImport(file: File): Promise<ChatFile> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());

    const chunks: ChatFileChunk[] = [];
    const workbookImages = workbook.model?.media ?? [];

    for (const worksheet of workbook.worksheets) {
        const worksheetImages = getWorksheetImages(worksheet);
        if (worksheetImages.length > 0 && typeof workbook.getImage !== 'function') {
            throw new Error('XLSX image extraction is unsupported for this workbook');
        }

        if (worksheetImages.length === 0 && workbookImages.length > 0 && typeof worksheet.getImages !== 'function') {
            throw new Error('XLSX image extraction is unsupported for this workbook');
        }

        const rowBlocks = buildWorksheetRowBlocks(worksheet);
        const sortedImages = worksheetImages.sort((left, right) => {
            if (left.row !== right.row) {
                return left.row - right.row;
            }

            return left.col - right.col;
        });

        let currentRowIndex = 0;
        for (const image of sortedImages) {
            const rowsBeforeImage = rowBlocks.filter((row) => row.rowNumber >= currentRowIndex && row.rowNumber < image.row);
            const markdown = rowsToMarkdown(rowsBeforeImage.map((row) => row.cells));
            if (markdown.length > 0) {
                chunks.push(createTextChunk(`${markdown}\n\n`, 'markdown'));
            }

            const workbookImage: ExcelJS.Image | undefined = workbook.getImage(image.imageId);
            const bytes = toUint8Array(workbookImage?.buffer);
            const extension = workbookImage?.extension;
            if (!bytes || !extension) {
                throw new Error('XLSX image extraction is unsupported for this workbook');
            }

            const chunk = await normalizeImageBytesToChunk(bytes, `image/${extension}`);
            if (chunk) {
                chunks.push(chunk);
            }
            currentRowIndex = image.row;
        }

        const remainingRows = rowBlocks.filter((row) => row.rowNumber >= currentRowIndex);
        const remainingMarkdown = rowsToMarkdown(remainingRows.map((row) => row.cells));
        if (remainingMarkdown.length > 0) {
            chunks.push(createTextChunk(`${remainingMarkdown}\n\n`, 'markdown'));
        }
    }

    return createChatFile(file.name, chunks);
}

function buildWorksheetRowBlocks(worksheet: ExcelJS.Worksheet): Array<{ rowNumber: number; cells: string[] }> {
    const rows: Array<{ rowNumber: number; cells: string[] }> = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const rowValues = Array.isArray(row.values) ? row.values.slice(1) : [];
        const cells = rowValues
            .map((value: ExcelJS.CellValue | undefined) => stringifyCellValue(value))
            .map((value: string) => value.trim());

        while (cells.length > 0 && cells[cells.length - 1] === '') {
            cells.pop();
        }

        if (cells.length === 0) {
            return;
        }

        rows.push({ rowNumber, cells });
    });

    return rows;
}

function rowsToMarkdown(rows: string[][]): string {
    if (rows.length === 0) {
        return '';
    }

    const width = Math.max(...rows.map((row) => row.length));
    const normalizedRows = rows.map((row) => {
        const padded = [...row];
        while (padded.length < width) {
            padded.push('');
        }

        return padded.map((cell) => escapeMarkdownTableCell(cell));
    });

    const header = normalizedRows[0];
    return [
        `| ${header.join(' | ')} |`,
        `| ${header.map(() => '---').join(' | ')} |`,
        ...normalizedRows.slice(1).map((row) => `| ${row.join(' | ')} |`)
    ].join('\n');
}

function getWorksheetImages(worksheet: ExcelJS.Worksheet): WorksheetImage[] {
    if (typeof worksheet.getImages !== 'function') {
        return [];
    }

    return worksheet.getImages().map((image) => ({
        imageId: Number(image.imageId),
        row: Number(image.range?.tl?.nativeRow ?? 0) + 1,
        col: Number(image.range?.tl?.nativeCol ?? 0) + 1
    }));
}

function stringifyCellValue(value: ExcelJS.CellValue | undefined): string {
    if (value === null || value === undefined) {
        return '';
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map((item) => stringifyCellValue(item as ExcelJS.CellValue)).join(', ');
    }

    if (typeof value === 'object') {
        if ('text' in value && typeof value.text === 'string') {
            return value.text;
        }

        if ('result' in value) {
            return stringifyCellValue(value.result as ExcelJS.CellValue);
        }

        if ('formula' in value && typeof value.formula === 'string') {
            return value.formula;
        }

        return JSON.stringify(value);
    }

    return String(value);
}

function toUint8Array(value: unknown): Uint8Array | null {
    if (value instanceof Uint8Array) {
        return value;
    }

    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value);
    }

    if (ArrayBuffer.isView(value)) {
        return new Uint8Array(value.buffer);
    }

    return null;
}
