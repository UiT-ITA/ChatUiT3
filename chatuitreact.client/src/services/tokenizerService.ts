import { signal, Signal } from '@preact/signals-react';
import { builtInTokenizer, type ParsedScheme, type TextEncoding, type Tokenizer } from '../utils/tokenCounting';

/**
 * Lazily loads one tokenizer vocabulary per encoding. Each `import()` below is a static
 * specifier so Vite emits one chunk per vocabulary, fetched the first time a model on
 * that encoding is seen and never otherwise. Estimate schemes need no vocabulary and are
 * built from the scheme itself, keyed by scheme id since the ratio is part of the scheme.
 */
const tokenizerSignals = new Map<string, Signal<Tokenizer | undefined>>();
const loading = new Map<TextEncoding, Promise<void>>();

export function getTokenizer(scheme: ParsedScheme): Signal<Tokenizer | undefined> {
    const builtIn = builtInTokenizer(scheme);
    const key = builtIn ? `scheme:${scheme.id}` : `encoding:${scheme.encoding}`;

    let tokenizerSignal = tokenizerSignals.get(key);
    if (!tokenizerSignal) {
        tokenizerSignal = signal<Tokenizer | undefined>(builtIn);
        tokenizerSignals.set(key, tokenizerSignal);
    }

    if (tokenizerSignal.value === undefined && !loading.has(scheme.encoding)) {
        loading.set(scheme.encoding, load(scheme.encoding, tokenizerSignal));
    }

    return tokenizerSignal;
}

async function load(encoding: TextEncoding, target: Signal<Tokenizer | undefined>): Promise<void> {
    try {
        const module = await importEncoding(encoding);
        // Special-token strings in user text are counted as their special token, which is
        // what the server tokenizer does too.
        const options = { allowedSpecial: module.ALL_SPECIAL_TOKENS as 'all' };
        target.value = { countTokens: (text) => module.countTokens(text, options) };
    } catch (error) {
        console.error(`Failed to load tokenizer for ${encoding}:`, error);
    } finally {
        loading.delete(encoding);
    }
}

function importEncoding(encoding: TextEncoding) {
    switch (encoding) {
        case 'o200k_base':
            return import('gpt-tokenizer/encoding/o200k_base');
        case 'cl100k_base':
            return import('gpt-tokenizer/encoding/cl100k_base');
        case 'char-estimate':
        case 'word-count':
            throw new Error('Estimate schemes need no vocabulary.');
    }
}
