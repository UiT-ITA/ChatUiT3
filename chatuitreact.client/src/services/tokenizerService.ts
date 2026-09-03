import { signal, Signal } from '@preact/signals-react';
import { charEstimateTokenizer, type TextEncoding, type Tokenizer } from '../utils/tokenCounting';

/**
 * Lazily loads one tokenizer vocabulary per encoding. Each `import()` below is a static
 * specifier so Vite emits one chunk per vocabulary, fetched the first time a model on
 * that encoding is seen and never otherwise.
 */
const tokenizerSignals = new Map<TextEncoding, Signal<Tokenizer | undefined>>();
const loading = new Map<TextEncoding, Promise<void>>();

export function getTokenizer(encoding: TextEncoding): Signal<Tokenizer | undefined> {
    let tokenizerSignal = tokenizerSignals.get(encoding);
    if (!tokenizerSignal) {
        tokenizerSignal = signal<Tokenizer | undefined>(
            encoding === 'char-estimate-3.5' ? charEstimateTokenizer : undefined,
        );
        tokenizerSignals.set(encoding, tokenizerSignal);
    }

    if (tokenizerSignal.value === undefined && !loading.has(encoding)) {
        loading.set(encoding, load(encoding, tokenizerSignal));
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
        case 'char-estimate-3.5':
            throw new Error('The character estimate needs no vocabulary.');
    }
}
