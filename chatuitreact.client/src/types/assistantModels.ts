import type { ChatFileChunkDto } from './chatModels';

export type AssistantFileCategory = 'alwaysLoaded' | 'selectiveLoaded' | 'ragLoaded';

/** Fixed text blocks the server appends after the owner's instructions. Ids match the server registry. */
export type PromptSnippetId = 'formatMarkdown' | 'equations' | 'basicUserInfo' | 'answerPreferences';

export const PROMPT_SNIPPET_IDS: readonly PromptSnippetId[] = ['formatMarkdown', 'equations', 'basicUserInfo', 'answerPreferences'];

export interface AssistantFileDto {
    // Absent for files that are new in a create/update request.
    id?: string;
    sourceFilename: string;
    category: AssistantFileCategory;
    description?: string;
    // Full content for new files when saving; metadata only (no text/base64) when
    // reading an assistant — content is fetched via fetchAssistantFile. A stored
    // file sent back without content is kept as-is on the server.
    chunks: ChatFileChunkDto[];
}

export interface FullAssistantDto {
    id: string;
    name: string;
    description?: string;
    tags: string[];
    modelId: string;
    systemPrompt?: string;
    temperature: number;
    reasoningEffort: ReasoningEffort;
    availableToolIds: string[];
    promptSnippets: PromptSnippetId[];
    isVisible: boolean;
    isFavorite: boolean;
    /**
     * Whether this user may pin this assistant as their default. Server-computed: false when the
     * assistant's model is gone, is not available to this user, or is not default-eligible.
     */
    canBeDefault: boolean;
    files: AssistantFileDto[];
    /**
     * Per token counting scheme: the fixed cost every request through this assistant pays
     * (system prompt with knowledge files, tool definitions, reply priming).
     */
    promptTokenCounts: Record<string, number>;
    /** The part of promptTokenCounts the knowledge-files section adds, per scheme. */
    knowledgeTokenCounts: Record<string, number>;
}

export interface AssistantSummaryDto {
    id: string;
    name: string;
    description?: string;
    tags: string[];
    modelId: string;
    isVisible: boolean;
    isFavorite: boolean;
    /**
     * Whether this user may pin this assistant as their default. Server-computed: false when the
     * assistant's model is gone, is not available to this user, or is not default-eligible.
     */
    canBeDefault: boolean;
    createdBy?: string;
    /** See FullAssistantDto.promptTokenCounts. */
    promptTokenCounts: Record<string, number>;
    /** The part of promptTokenCounts the knowledge-files section adds, per scheme. */
    knowledgeTokenCounts: Record<string, number>;
}

export interface AssistantListDto {
    owned: FullAssistantDto[];
    system: AssistantSummaryDto[];
    shared: AssistantSummaryDto[];
    /**
     * The assistant this user pinned, exactly as stored, or null. Not filtered against
     * eligibility on purpose: check the pinned assistant's canBeDefault to tell "pinned and
     * active" from "pinned but currently inactive".
     */
    defaultAssistantId: string | null;
}

export interface AssistantDto {
    id: string;
    name: string;
    description?: string;
    tags: string[];
    modelId: string;
    systemPrompt?: string;
    temperature?: number;
    reasoningEffort?: ReasoningEffort;
    isVisible: boolean;
    isFavorite: boolean;
    /**
     * Whether this user may pin this assistant as their default. Server-computed: false when the
     * assistant's model is gone, is not available to this user, or is not default-eligible.
     */
    canBeDefault: boolean;
    type: 'owned' | 'system' | 'shared';
    /** See FullAssistantDto.promptTokenCounts. */
    promptTokenCounts: Record<string, number>;
    /** The part of promptTokenCounts the knowledge-files section adds, per scheme. */
    knowledgeTokenCounts: Record<string, number>;
}

export interface CreateAssistantDto {
    name: string;
    description?: string;
    tags?: string[];
    modelId: string;
    systemPrompt?: string;
    temperature?: number;
    reasoningEffort?: ReasoningEffort;
    availableToolIds?: string[];
    promptSnippets?: PromptSnippetId[];
    files?: AssistantFileDto[];
}

export interface UpdateAssistantDto {
    id: string;
    name: string;
    description?: string;
    tags?: string[];
    modelId: string;
    systemPrompt?: string;
    temperature?: number;
    reasoningEffort?: ReasoningEffort;
    availableToolIds?: string[];
    promptSnippets?: PromptSnippetId[];
    files?: AssistantFileDto[];
}

/** Which levels a given model actually accepts varies — see UserModelCapabilitiesDto.supportedEfforts. */
export type ReasoningEffort =
    "None"
    | "Low"
    | "Medium"
    | "High"
    | "XHigh"
    | "Max";

export interface ChatToolDto {
    id: string;
    name: string;
    description: string;
}
