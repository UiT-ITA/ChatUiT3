export interface PrivateAssistantDto {
    id: string;
    name: string;
    description?: string;
    tags: string[];
    model: {
        id: string;
        modelName: string;
    };
    systemPrompt?: string;
    temperature: number;
    reasoningEffort: ReasoningEffort;
    availableToolIds: string[];
    isVisible: boolean;
}

export interface SystemAssistantDto {
    id: string;
    name: string;
    description?: string;
    tags: string[];
    modelName: string;
    isVisible: boolean;
}

export interface SharedAssistantDto {
    id: string;
    name: string;
    description?: string;
    tags: string[];
    modelName: string;
    isVisible: boolean;
    createdBy?: string;
}

export interface AssistantListDto {
    owned: PrivateAssistantDto[];
    system: SystemAssistantDto[];
    shared: SharedAssistantDto[];
}

export interface AssistantDto {
    id: string;
    name: string;
    description?: string;
    tags: string[];
    modelId?: string;
    modelName?: string;
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

// export enum ReasoningEffort {
//     None = "None",
//     Low = "Low",
//     Medium = "Medium",
//     High = "High",
// }



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
