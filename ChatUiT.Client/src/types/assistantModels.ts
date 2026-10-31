import type { ChatFileChunkDto } from './chatModels';
import type { DataClassification } from './modelModels';

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
    /** Per scheme: what the file costs as the message that carries it. Set when reading an assistant. */
    tokenCounts?: Record<string, number>;
}

export type UserRole = 'User' | 'Admin' | 'Beta' | 'Super' | 'External';

/** Who may use a system assistant. Null means everyone. Ignored on private assistants. */
export interface AssistantAccessPolicyDto {
    allowedRoles: UserRole[];
    /** Entra ID group object ids. */
    allowedGroupIds: string[];
}

export interface FullAssistantDto {
    id: string;
    name: string;
    description?: string;
    tags: string[];
    modelId: string;
    /** The lowest classification of the model and the tools of the selected toolboxes. Server-computed. */
    classification: DataClassification;
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
    /** System assistants only. Null means everyone. */
    access?: AssistantAccessPolicyDto | null;
    files: AssistantFileDto[];
    /** Knowledge sources loaded each time a message is sent. Ids match the server registry. */
    knowledgeSourceIds: string[];
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
    /** The lowest classification of the model and the tools of the selected toolboxes. Server-computed. */
    classification: DataClassification;
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
    /** The lowest classification of the model and the tools of the selected toolboxes. Server-computed. */
    classification: DataClassification;
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
    knowledgeSourceIds?: string[];
    /** System assistants only; ignored on user endpoints. Null means everyone. */
    access?: AssistantAccessPolicyDto | null;
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
    knowledgeSourceIds?: string[];
    /** System assistants only; ignored on user endpoints. Null means everyone. */
    access?: AssistantAccessPolicyDto | null;
}

/** Which levels a given model actually accepts varies — see UserLanguageModelCapabilitiesDto.supportedEfforts. */
export type ReasoningEffort =
    "None"
    | "Low"
    | "Medium"
    | "High"
    | "XHigh"
    | "Max";

/** Background knowledge the server loads at send time, which the current user may give to an assistant. */
export interface KnowledgeSourceDto {
    id: string;
    displayName: string;
    description: string;
    /** Heading the editor groups sources under. */
    group: string;
}

/** A server tool the current user may give to an assistant. */
export interface ChatToolDto {
    id: string;
    name: string;
    description: string;
    /** The user must approve each call before it runs. */
    requiresConfirmation: boolean;
    /** Delegated Microsoft Graph scopes the tool needs. */
    requiredScopes: string[];
    execution: 'server' | 'client';
    /** The lowest classification of the toolbox's own functions. Children carry their own. */
    classification: DataClassification;
    /** Child toolboxes, shown as options under this one. Only those the caller may use. */
    children: ChatToolDto[];
}
