import JSZip from 'jszip';
import type { ChatFile, ChatFileChunk } from '../types/fileModels';
import {
    createChatFile,
    createTextChunk,
    escapeMarkdownTableCell,
    getRelationshipTargets,
    normalizeImageBlobToChunk,
    parseXmlDocument,
    resolveZipPath
} from './processingShared';

export async function processPptxImport(file: File): Promise<ChatFile> {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slideNames = Object.keys(zip.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort(compareOpenXmlPartNames);

    const chunks: ChatFileChunk[] = [];

    for (const slideName of slideNames) {
        const slideXml = await zip.file(slideName)?.async('text');
        const relsName = slideName.replace('slides/', 'slides/_rels/') + '.rels';
        const relsXml = await zip.file(relsName)?.async('text');

        if (!slideXml || !relsXml) {
            continue;
        }

        const relTargets = getRelationshipTargets(relsXml, relsName);
        const slideDocument = parseXmlDocument(slideXml);
        const shapeTree = Array.from(slideDocument.getElementsByTagName('*')).find((element) => element.localName === 'spTree');

        if (!shapeTree) {
            continue;
        }

        const slideChunks = await processSlideChildren(Array.from(shapeTree.childNodes), zip, relTargets, slideName);
        chunks.push(...slideChunks);
    }

    return createChatFile(file.name, chunks);
}

async function processSlideChildren(
    children: Node[],
    zip: JSZip,
    relTargets: Map<string, string>,
    slideName: string
): Promise<ChatFileChunk[]> {
    const chunks: ChatFileChunk[] = [];

    for (const child of children) {
        if (!(child instanceof Element)) {
            continue;
        }

        if (child.localName === 'sp' || child.localName === 'graphicFrame') {
            const markdown = extractShapeMarkdown(child);
            if (markdown.length > 0) {
                chunks.push(createTextChunk(`${markdown}\n\n`, 'markdown'));
            }
            continue;
        }

        if (child.localName === 'pic') {
            const blip = Array.from(child.getElementsByTagName('*')).find((element) => element.localName === 'blip');
            const relationshipId = blip?.getAttribute('r:embed') ?? blip?.getAttribute('embed');
            if (!relationshipId) {
                continue;
            }

            const target = relTargets.get(relationshipId);
            if (!target) {
                continue;
            }

            const imagePath = resolveZipPath(slideName, target);
            const imageFile = zip.file(imagePath);
            if (!imageFile) {
                continue;
            }

            const imageBlob = await imageFile.async('blob');
            const chunk = await normalizeImageBlobToChunk(imageBlob);
            if (chunk) {
                chunks.push(chunk);
            }
            continue;
        }

        if (child.localName === 'grpSp') {
            chunks.push(...await processSlideChildren(Array.from(child.childNodes), zip, relTargets, slideName));
        }
    }

    return chunks;
}

function extractShapeMarkdown(shape: Element): string {
    const table = Array.from(shape.getElementsByTagName('*')).find((element) => element.localName === 'tbl');
    if (table) {
        return extractTableMarkdown(table);
    }

    const paragraphs = Array.from(shape.getElementsByTagName('*'))
        .filter((element) => element.localName === 'p')
        .map((paragraph) => {
            const texts = Array.from(paragraph.getElementsByTagName('*'))
                .filter((element) => element.localName === 't')
                .map((element) => element.textContent ?? '')
                .join('')
                .trim();

            if (texts.length === 0) {
                return '';
            }

            const bullet = Array.from(paragraph.getElementsByTagName('*')).some((element) => {
                return element.localName === 'buChar' || element.localName === 'buAutoNum';
            });

            return bullet ? `- ${texts}` : texts;
        })
        .filter((value) => value.length > 0);

    return paragraphs.join('\n\n');
}

function extractTableMarkdown(table: Element): string {
    const rows = Array.from(table.getElementsByTagName('*'))
        .filter((element) => element.localName === 'tr')
        .map((row) => {
            return Array.from(row.getElementsByTagName('*'))
                .filter((element) => element.localName === 'tc')
                .map((cell) => {
                    const text = Array.from(cell.getElementsByTagName('*'))
                        .filter((element) => element.localName === 't')
                        .map((element) => element.textContent ?? '')
                        .join('')
                        .trim();

                    return escapeMarkdownTableCell(text);
                });
        })
        .filter((row) => row.length > 0);

    if (rows.length === 0) {
        return '';
    }

    const header = rows[0];
    return [
        `| ${header.join(' | ')} |`,
        `| ${header.map(() => '---').join(' | ')} |`,
        ...rows.slice(1).map((row) => `| ${row.join(' | ')} |`)
    ].join('\n');
}

function compareOpenXmlPartNames(left: string, right: string): number {
    const leftNumber = Number(left.match(/(\d+)/)?.[1] ?? '0');
    const rightNumber = Number(right.match(/(\d+)/)?.[1] ?? '0');
    return leftNumber - rightNumber;
}
