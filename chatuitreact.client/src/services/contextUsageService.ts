import { computed, signal, Signal } from '@preact/signals-react';
import type { ChatFile } from '../types/fileModels';
import { getAssistant } from './assistantService';
import { getChat, getCurrentAssistantId } from './chatService';
import { getModels } from './modelService';
import { getTokenizer } from './tokenizerService';
import { countDraftTokens, parseScheme } from '../utils/tokenCounting';

/**
 * What the next request will cost against the current model's context window. Everything
 * except the draft comes pre-counted from the server; the current assistant (not the chat's
 * stored one) decides which scheme key is read, since the next send goes to that assistant.
 */
export interface ContextUsage {
    /** Scheme parsed, assistant and model resolved, tokenizer ready. */
    available: boolean;
    scheme: string | null;
    isEstimate: boolean;
    contextSize: number;
    maxOutputTokens: number;
    /** System prompt with knowledge files, tool definitions, reply priming. */
    fixed: number;
    /** Sum of stored message counts. */
    history: number;
    draft: number;
    total: number;
    /** Messages with no stored count for this scheme; the total is a lower bound then. */
    unknownMessages: number;
    overLimit: boolean;
    /** The answer may not fit: total plus the model's output ceiling exceeds the window. */
    nearLimit: boolean;
}

const UNAVAILABLE: ContextUsage = {
    available: false,
    scheme: null,
    isEstimate: false,
    contextSize: 0,
    maxOutputTokens: 0,
    fixed: 0,
    history: 0,
    draft: 0,
    total: 0,
    unknownMessages: 0,
    overLimit: false,
    nearLimit: false,
};

const draftSignal = signal<{ text: string; files: ChatFile[] }>({ text: '', files: [] });

export function setDraft(text: string, files: ChatFile[]): void {
    const current = draftSignal.value;
    if (current.text === text && current.files === files) return;
    draftSignal.value = { text, files };
}

export function getContextUsage(chatId: string | undefined): Signal<ContextUsage> {
    return computed<ContextUsage>(() => {
        const assistantId = getCurrentAssistantId().value;
        if (!assistantId) return UNAVAILABLE;

        const assistant = getAssistant(assistantId).value;
        if (!assistant) return UNAVAILABLE;

        const model = getModels().value?.find((m) => m.id === assistant.modelId);
        if (!model) return UNAVAILABLE;

        const scheme = parseScheme(model.capabilities.tokenCountingScheme);
        if (!scheme) return UNAVAILABLE;

        const tokenizer = getTokenizer(scheme.encoding).value;
        if (!tokenizer) return { ...UNAVAILABLE, scheme: scheme.id, isEstimate: scheme.isEstimate };

        const fixed = assistant.promptTokenCounts?.[scheme.id] ?? 0;

        let history = 0;
        let unknownMessages = 0;
        const chat = chatId !== undefined ? getChat(chatId).value : undefined;
        for (const message of chat?.messages ?? []) {
            if (message.status === 'Generating') continue;
            const tokens = message.tokenCounts?.[scheme.id];
            if (tokens === undefined) {
                unknownMessages++;
            } else {
                history += tokens;
            }
        }

        const { text, files } = draftSignal.value;
        const draft = text.length > 0 || files.length > 0 ? countDraftTokens(text, files, tokenizer, scheme.image) : 0;

        const contextSize = model.capabilities.contextSize;
        const maxOutputTokens = model.capabilities.maxOutputTokens;
        const total = fixed + history + draft;

        return {
            available: true,
            scheme: scheme.id,
            isEstimate: scheme.isEstimate,
            contextSize,
            maxOutputTokens,
            fixed,
            history,
            draft,
            total,
            unknownMessages,
            overLimit: total > contextSize,
            nearLimit: total + maxOutputTokens > contextSize,
        };
    });
}
