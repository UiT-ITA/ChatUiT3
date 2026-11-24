import type { ChatFileChunkDto } from './chatModels';
import type { DataClassification } from './modelModels';

export type AssistantFileCategory = 'alwaysLoaded' | 'selectiveLoaded' | 'ragLoaded';

/** Fixed text blocks the server appends after the owner's instructions. Ids match the server registry. */
export type PromptSnippetId = 'formatMarkdown' | 'equations' | 'htmlVisuals' | 'basicUserInfo' | 'answerPreferences';

export const PROMPT_SNIPPET_IDS: readonly PromptSnippetId[] = ['formatMarkdown', 'equations', 'htmlVisuals', 'basicUserInfo', 'answerPreferences'];

/** A stored file of an assistant. */
export interface AssistantFileDto {
    id: string;
    sourceFilename: string;
    category: AssistantFileCategory;
    description?: string;
    /** The file's parts, without their text and image data. fetchAssistantFile gives them with it. */
    chunks: ChatFileChunkDto[];
    /** Per scheme: what the file costs as the message that carries it. */
    tokenCounts: Record<string, number>;
}

/** A file in an update request: one the assistant keeps. New files are uploaded to the assistant. */
export interface AssistantFileRefDto {
    id: string;
    sourceFilename: string;
    category: AssistantFileCategory;
    description?: string;
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
    availableToolIds: string[];
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
    reasoningEffort?: ReasoningEffort;
    availableToolIds?: string[];
    promptSnippets?: PromptSnippetId[];
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
    reasoningEffort?: ReasoningEffort;
    availableToolIds?: string[];
    promptSnippets?: PromptSnippetId[];
    /** The files the assistant keeps. A stored file that is not listed is deleted. */
    files?: AssistantFileRefDto[];
    knowledgeSourceIds?: string[];
    /** System assistants only; ignored on user endpoints. Null means everyone. */
    access?: AssistantAccessPolicyDto | null;
}

/** Which levels an assistant can choose on a given model varies — see UserLanguageModelCapabilitiesDto.assistantEfforts. */
export type ReasoningEffort =
    "None"
    | "Low"
    | "Medium"
    | "High"
    | "XHigh"
    | "Max";

/** The reasoning choices an assistant offers: Fast (None, or Low when the model always reasons), Normal (Medium) and Extra (High). */
export type ReasoningTier = "fast" | "normal" | "extra";

/** The tier an effort belongs to, or undefined for levels above High. */
export function reasoningTier(effort: ReasoningEffort): ReasoningTier | undefined {
    switch (effort) {
        case "None":
        case "Low":
            return "fast";
        case "Medium":
            return "normal";
        case "High":
            return "extra";
        default:
            return undefined;
    }
}

const TIER_ORDER: ReasoningTier[] = ["fast", "normal", "extra"];

const tierIndex = (effort: ReasoningEffort) => TIER_ORDER.indexOf(reasoningTier(effort) ?? "extra");

/**
 * Maps an effort onto the model's assistant level for the same tier, with levels above High counted
 * as Extra. A tier the model lacks steps down to the nearest lower tier, else up to the lowest one.
 * Mirrors the server's Assistant.NormalizeEffort.
 */
export function clampAssistantEffort(requested: ReasoningEffort | undefined, levels: ReasoningEffort[] | undefined): ReasoningEffort {
    if (!levels || levels.length === 0) return "None";

    const tier = tierIndex(requested ?? "None");
    return [...levels].reverse().find(level => tierIndex(level) <= tier) ?? levels[0];
}

/** Background knowledge the server loads at send time, which the current user may give to an assistant. */
export interface KnowledgeSourceDto {
    id: string;
    displayName: string;
    description: string;
    /** Heading the editor groups sources under. */
    group: string;
}

/** A server tool the current user may give to an assistant. */
/** A tool and every toolbox under it. */
export const withDescendants = (tool: ChatToolDto): ChatToolDto[] => [tool, ...tool.children.flatMap(withDescendants)];

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
