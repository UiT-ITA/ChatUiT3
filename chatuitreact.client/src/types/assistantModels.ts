import type { ChatFileChunkDto } from './chatModels';

export type AssistantFileCategory = 'alwaysLoaded' | 'selectiveLoaded' | 'ragLoaded';

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
    isVisible: boolean;
    files: AssistantFileDto[];
}

export interface AssistantSummaryDto {
    id: string;
    name: string;
    description?: string;
    tags: string[];
    modelId: string;
    isVisible: boolean;
    createdBy?: string;
}

export interface AssistantListDto {
    owned: FullAssistantDto[];
    system: AssistantSummaryDto[];
    shared: AssistantSummaryDto[];
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
    type: 'owned' | 'system' | 'shared';
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
