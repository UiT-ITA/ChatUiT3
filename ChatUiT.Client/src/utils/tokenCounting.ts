/**
 * Tokens are counted on the server only, and arrive as `tokenCounts` on messages and files and
 * `promptTokenCounts` on assistants, keyed by scheme id. This reads a model's scheme id and
 * formats the counts.
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
    /** False for the text-only variant: images count as the note sent in their place. */
    countsImages: boolean;
}

/** Must equal TokenCountingSchemes.TextOnlySuffix on the server. */
const TEXT_ONLY_SUFFIX = ':text-only';

const ANTHROPIC_CHARS_PER_TOKEN = 3.5;
const MAX_CHARS_PER_TOKEN = 20;

const DEFAULT_TILE: ImageRule = { kind: 'tile', baseTokens: 85, tokensPerTile: 170 };
// Anthropic's image rule, also used by the generic estimates since they have none of their own.
const ESTIMATE_IMAGE: ImageRule = { kind: 'area', pixelsPerToken: 750 };

export function parseScheme(id: string | null | undefined): ParsedScheme | null {
    const normalized = id?.trim().toLowerCase();
    if (!normalized) return null;

    if (normalized.endsWith(TEXT_ONLY_SUFFIX)) {
        const withImages = parseScheme(normalized.slice(0, -TEXT_ONLY_SUFFIX.length));
        if (!withImages || !withImages.countsImages) return null;
        return { ...withImages, id: normalized, countsImages: false };
    }

    const scheme = parseImageScheme(normalized);
    return scheme && { ...scheme, countsImages: true };
}

function parseImageScheme(normalized: string): Omit<ParsedScheme, 'countsImages'> | null {
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

/** Must equal AlwaysLoadedFileLimit.MaxTokens on the server. */
const ALWAYS_LOADED_MAX_TOKENS = 100_000;

/** How many tokens an assistant's always-loaded files may use together. Mirrors AlwaysLoadedFileLimit on the server. */
export function alwaysLoadedLimit(contextSize: number): number {
    return Math.min(Math.floor(contextSize / 2), ALWAYS_LOADED_MAX_TOKENS);
}

export function formatTokens(value: number, locale: string): string {
    return new Intl.NumberFormat(locale).format(value);
}

export function formatTokensCompact(value: number, locale: string): string {
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
