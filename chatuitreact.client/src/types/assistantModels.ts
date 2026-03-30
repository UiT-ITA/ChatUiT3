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
}

export type ReasoningEffort = 
    "None" 
    | "Low" 
    | "Medium" 
    | "High";

export interface ChatToolDto {
    id: string;
    name: string;
    description: string;
}
