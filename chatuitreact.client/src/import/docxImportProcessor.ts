import JSZip from 'jszip';
import type { ChatFile, ChatFileChunk } from '../types/fileModels';
import {
    collectElementText,
    createChatFile,
    createTextChunk,
    escapeMarkdownTableCell,
    getRelationshipTargets,
    normalizeImageBlobToChunk,
    parseXmlDocument,
    resolveZipPath
} from './processingShared';

export async function processDocxImport(file: File): Promise<ChatFile> {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const documentXml = await zip.file('word/document.xml')?.async('text');
    const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('text');

    if (!documentXml || !relsXml) {
        throw new Error('DOCX document content is missing');
    }

    const relationshipTargets = getRelationshipTargets(relsXml, 'word/_rels/document.xml.rels');
    const documentNode = parseXmlDocument(documentXml);
    const body = Array.from(documentNode.getElementsByTagName('*')).find((element) => element.localName === 'body');

    if (!body) {
        throw new Error('DOCX body is missing');
    }

    const chunks: ChatFileChunk[] = [];

    for (const child of Array.from(body.childNodes)) {
        if (!(child instanceof Element)) {
            continue;
        }

        if (child.localName === 'p') {
            const paragraphChunks = await processParagraph(child, zip, relationshipTargets);
            chunks.push(...paragraphChunks);
            continue;
        }

        if (child.localName === 'tbl') {
            const tableMarkdown = processTable(child);
            if (tableMarkdown.length > 0) {
                chunks.push(createTextChunk(`${tableMarkdown}\n\n`, 'markdown'));
            }
        }
    }

    return createChatFile(file.name, chunks);
}

async function processParagraph(
    paragraph: Element,
    zip: JSZip,
    relationshipTargets: Map<string, string>
): Promise<ChatFileChunk[]> {
    const chunks: ChatFileChunk[] = [];
    let textBuffer = '';
    let prefixUsed = false;

    const paragraphPrefix = getParagraphPrefix(paragraph);

    const flushText = () => {
        const normalized = normalizeParagraphText(textBuffer);
        textBuffer = '';
        if (normalized.length === 0) {
            return;
        }

        const prefix = prefixUsed ? '' : paragraphPrefix;
        prefixUsed = true;
        chunks.push(createTextChunk(`${prefix}${normalized}\n\n`, 'markdown'));
    };

    const visit = async (node: Node): Promise<void> => {
        if (!(node instanceof Element)) {
            return;
        }

        if (node.localName === 't') {
            textBuffer += node.textContent ?? '';
            return;
        }

        if (node.localName === 'tab') {
            textBuffer += '\t';
            return;
        }

        if (node.localName === 'br') {
            textBuffer += '\n';
            return;
        }

        if (node.localName === 'drawing') {
            flushText();

            const blips = Array.from(node.getElementsByTagName('*')).filter((element) => element.localName === 'blip');
            for (const blip of blips) {
                const relationshipId = blip.getAttribute('r:embed') ?? blip.getAttribute('embed');
                if (!relationshipId) {
                    continue;
                }

                const target = relationshipTargets.get(relationshipId);
                if (!target) {
                    continue;
                }

                const imageFile = zip.file(resolveZipPath('word/document.xml', target));
                if (!imageFile) {
                    continue;
                }

                const imageBlob = await imageFile.async('blob');
                const chunk = await normalizeImageBlobToChunk(imageBlob);
                if (chunk) {
                    chunks.push(chunk);
                }
            }

            return;
        }

        for (const child of Array.from(node.childNodes)) {
            await visit(child);
        }
    };

    for (const child of Array.from(paragraph.childNodes)) {
        await visit(child);
    }

    flushText();

    return chunks;
}

function getParagraphPrefix(paragraph: Element): string {
    const style = Array.from(paragraph.getElementsByTagName('*')).find((element) => element.localName === 'pStyle');
    const styleValue = style?.getAttribute('w:val') ?? style?.getAttribute('val') ?? '';
    const headingMatch = /^Heading([1-6])$/i.exec(styleValue);
    if (headingMatch) {
        return `${'#'.repeat(Number(headingMatch[1]))} `;
    }

    const hasNumbering = Array.from(paragraph.getElementsByTagName('*')).some((element) => element.localName === 'numPr');
    if (hasNumbering) {
        return '- ';
    }

    return '';
}

function normalizeParagraphText(text: string): string {
    return text.replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').replace(/\s+/g, ' ').trim();
}

function processTable(table: Element): string {
    const rows = Array.from(table.childNodes)
        .filter((node): node is Element => node instanceof Element && node.localName === 'tr')
        .map((row) => {
            return Array.from(row.childNodes)
                .filter((node): node is Element => node instanceof Element && node.localName === 'tc')
                .map((cell) => escapeMarkdownTableCell(collectElementText(cell).trim()));
        })
        .filter((row) => row.length > 0);

    if (rows.length === 0) {
        return '';
    }

    const header = rows[0];
    const separator = header.map(() => '---');
    const body = rows.slice(1);

    return [
        `| ${header.join(' | ')} |`,
        `| ${separator.join(' | ')} |`,
        ...body.map((row) => `| ${row.join(' | ')} |`)
    ].join('\n');
}
