export interface UserModelCapabilitiesDto {
    vision: boolean;
    reasoning: boolean;
    tools: boolean;
    contextSize: number;
    maxOutputTokens: number;
    knowledgeCutoff: string; // "YYYY-MM"
}

export interface UserModelDto {
    id: string;
    modelName: string;
    description: string;
    capabilities: UserModelCapabilitiesDto;
}
