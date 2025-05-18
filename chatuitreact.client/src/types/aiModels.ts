export interface AiModel {
    id: string;
    name: string;
    description: string;
    modelId: string;
    modelType: AiModelType;
    endpoint: AiModelEndpoint;
    capabilities: AiModelCapabilities;
}

export enum AiModelType {
    AzureOpenAI = 'AzureOpenAI',
    OpenAI = 'OpenAI',
    Anthropic = 'Anthropic',
    LlamaCpp = 'LlamaCpp',
    Other = 'Other',
}

export interface AiModelEndpoint {
    id: string;
    url: string;
    apiKey: string;
}

export interface AiModelSettings {
    model: string;
    temperature: number;
    maxTokens: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
    reasoningEffort: ReasoningEffort;
}

export interface AiModelCapabilities {
    supportsVision: boolean;
    supportsReasoning: boolean;
    supportsFunctionCalling: boolean;
    supportsCodeInterpreter: boolean;
    maxContextLength: number;
    maxOutputLength: number;
}

export enum ReasoningEffort {
    None = 'None',
    Low = 'Low',
    Medium = 'Medium',
    High = 'High',
}
