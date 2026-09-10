import type { ChatFile } from '../types/fileModels';

/**
 * Client-side counting for the draft only. Everything already on the server is counted
 * there and arrives as `tokenCounts` on messages and `promptTokenCounts` on assistants.
 * The rules here mirror the server's TokenCounting folder exactly, so the number shown
 * before send equals the number stored after send.
 */

export type TextEncoding = 'o200k_base' | 'cl100k_base' | 'char-estimate' | 'word-count';

export type ImageRule =
    | { kind: 'tile'; baseTokens: number; tokensPerTile: number }
    | { kind: 'patch'; multiplier: number }
    | { kind: 'area'; pixelsPerToken: number };

export interface ParsedScheme {
    id: string;
    encoding: TextEncoding;
    image: ImageRule;
    isEstimate: boolean;
    /** Set only for 'char-estimate'. */
    charsPerToken?: number;
}

export interface Tokenizer {
    countTokens(text: string): number;
}

/** Per-message framing. Must equal TokenCountingService.MessageFramingTokens on the server. */
export const MESSAGE_FRAMING_TOKENS = 4;

const ANTHROPIC_CHARS_PER_TOKEN = 3.5;
const MAX_CHARS_PER_TOKEN = 20;

const DEFAULT_TILE: ImageRule = { kind: 'tile', baseTokens: 85, tokensPerTile: 170 };
// Anthropic's image rule, also used by the generic estimates since they have none of their own.
const ESTIMATE_IMAGE: ImageRule = { kind: 'area', pixelsPerToken: 750 };

// The client's normalization bound, and the server's fallback when a header cannot be read.
const FALLBACK_IMAGE_WIDTH = 2048;
const FALLBACK_IMAGE_HEIGHT = 1024;

export function parseScheme(id: string | null | undefined): ParsedScheme | null {
    const normalized = id?.trim().toLowerCase();
    if (!normalized) return null;

    if (normalized === 'o200k-tile') {
        return { id: normalized, encoding: 'o200k_base', image: DEFAULT_TILE, isEstimate: false };
    }
    if (normalized === 'cl100k-tile') {
        return { id: normalized, encoding: 'cl100k_base', image: DEFAULT_TILE, isEstimate: false };
    }
    if (normalized === 'anthropic-estimate') {
        return { id: normalized, encoding: 'char-estimate', image: ESTIMATE_IMAGE, isEstimate: true, charsPerToken: ANTHROPIC_CHARS_PER_TOKEN };
    }
    if (normalized === 'word-count') {
        return { id: normalized, encoding: 'word-count', image: ESTIMATE_IMAGE, isEstimate: true };
    }

    const charEstimate = /^char-est-(\d+(?:\.\d+)?)$/.exec(normalized);
    if (charEstimate) {
        const charsPerToken = Number(charEstimate[1]);
        if (!(charsPerToken > 0 && charsPerToken <= MAX_CHARS_PER_TOKEN)) return null;
        return { id: normalized, encoding: 'char-estimate', image: ESTIMATE_IMAGE, isEstimate: true, charsPerToken };
    }

    const tile = /^(o200k|cl100k)-tile-(\d+)-(\d+)$/.exec(normalized);
    if (tile) {
        const tokensPerTile = Number(tile[3]);
        if (tokensPerTile <= 0) return null;
        return {
            id: normalized,
            encoding: tile[1] === 'o200k' ? 'o200k_base' : 'cl100k_base',
            image: { kind: 'tile', baseTokens: Number(tile[2]), tokensPerTile },
            isEstimate: false,
        };
    }

    const patch = /^o200k-patch-(\d+(?:\.\d+)?)$/.exec(normalized);
    if (patch) {
        const multiplier = Number(patch[1]);
        if (!(multiplier > 0 && multiplier <= 10)) return null;
        return { id: normalized, encoding: 'o200k_base', image: { kind: 'patch', multiplier }, isEstimate: false };
    }

    return null;
}

/** The estimate encodings need no vocabulary; the tiktoken ones are loaded by tokenizerService. */
export function charEstimateTokenizer(charsPerToken: number): Tokenizer {
    return { countTokens: (text) => (text.length === 0 ? 0 : Math.ceil(text.length / charsPerToken)) };
}

/** Whitespace-separated words; matches the server's Split on whitespace. */
export const wordCountTokenizer: Tokenizer = {
    countTokens: (text) => text.split(/\s+/).filter((word) => word.length > 0).length,
};

/** The tokenizer for a scheme that needs no vocabulary, or undefined when it needs one. */
export function builtInTokenizer(scheme: ParsedScheme): Tokenizer | undefined {
    switch (scheme.encoding) {
        case 'char-estimate':
            return charEstimateTokenizer(scheme.charsPerToken ?? ANTHROPIC_CHARS_PER_TOKEN);
        case 'word-count':
            return wordCountTokenizer;
        default:
            return undefined;
    }
}

export function countImageTokens(width: number, height: number, rule: ImageRule): number {
    let w = Math.max(1, width);
    let h = Math.max(1, height);

    switch (rule.kind) {
        case 'tile': {
            const longest = Math.max(w, h);
            if (longest > 2048) {
                const scale = 2048 / longest;
                w *= scale;
                h *= scale;
            }
            const shortest = Math.min(w, h);
            if (shortest > 768) {
                const scale = 768 / shortest;
                w *= scale;
                h *= scale;
            }
            const tiles = Math.ceil(w / 512) * Math.ceil(h / 512);
            return rule.baseTokens + rule.tokensPerTile * tiles;
        }
        case 'patch': {
            const patchSize = 32;
            const maxPatches = 1536;
            let patches = Math.ceil(w / patchSize) * Math.ceil(h / patchSize);
            if (patches > maxPatches) {
                let scale = Math.sqrt((patchSize * patchSize * maxPatches) / (w * h));
                let scaledW = w * scale;
                let scaledH = h * scale;
                scale *= Math.min(
                    Math.floor(scaledW / patchSize) / (scaledW / patchSize),
                    Math.floor(scaledH / patchSize) / (scaledH / patchSize),
                );
                scaledW = w * scale;
                scaledH = h * scale;
                patches = Math.ceil(scaledW / patchSize) * Math.ceil(scaledH / patchSize);
            }
            return Math.round(Math.min(patches, maxPatches) * rule.multiplier);
        }
        case 'area':
            return Math.ceil((w * h) / rule.pixelsPerToken);
    }
}

type Part = { kind: 'text'; text: string } | { kind: 'image'; width: number; height: number };

// The same part sequence MessageParts.Build produces on the server, images always allowed.
function buildParts(text: string, files: ChatFile[]): Part[] {
    const parts: Part[] = [];
    if (text.length > 0) {
        parts.push({ kind: 'text', text });
    }

    for (const file of files) {
        parts.push({ kind: 'text', text: `\n--- ATTACHED FILE: ${file.sourceFilename} ---\n` });
        file.chunks.forEach((chunk, index) => {
            parts.push({ kind: 'text', text: `[File Part ${index + 1} of ${file.chunks.length}]\n` });
            if (chunk.type === 'text') {
                parts.push({ kind: 'text', text: chunk.text + '\n' });
            } else if (chunk.base64) {
                parts.push({
                    kind: 'image',
                    width: chunk.width ?? FALLBACK_IMAGE_WIDTH,
                    height: chunk.height ?? FALLBACK_IMAGE_HEIGHT,
                });
                parts.push({ kind: 'text', text: '\n' });
            }
        });
        parts.push({ kind: 'text', text: `--- END OF FILE: ${file.sourceFilename} ---\n\n` });
    }

    return parts;
}

// Adjacent text parts are counted as one string, matching the server.
function countParts(parts: Part[], tokenizer: Tokenizer, rule: ImageRule): number {
    let total = 0;
    let run = '';
    for (const part of parts) {
        if (part.kind === 'text') {
            run += part.text;
        } else {
            if (run) {
                total += tokenizer.countTokens(run);
                run = '';
            }
            total += countImageTokens(part.width, part.height, rule);
        }
    }
    if (run) {
        total += tokenizer.countTokens(run);
    }
    return total;
}

/** What the draft will cost once sent, framing included. */
export function countDraftTokens(text: string, files: ChatFile[], tokenizer: Tokenizer, rule: ImageRule): number {
    return MESSAGE_FRAMING_TOKENS + countParts(buildParts(text, files), tokenizer, rule);
}

export function formatTokens(value: number, locale: string): string {
    return new Intl.NumberFormat(locale).format(value);
}

export function formatTokensCompact(value: number, locale: string): string {
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
