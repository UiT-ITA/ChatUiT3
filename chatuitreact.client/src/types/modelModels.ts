import type { ReasoningEffortLevel, TemperatureSupport } from './admin';

/**
 * The user-facing view of a model. Deliberately narrower than the admin `ModelDto`:
 * it drives which controls the assistant form shows and carries no endpoint detail.
 */
export interface UserModelCapabilitiesDto {
    vision: boolean;
    tools: boolean;
    temperature: TemperatureSupport;
    /** Empty means the model does not reason; omitting 'None' means reasoning cannot be turned off. */
    supportedEfforts: ReasoningEffortLevel[];
    contextSize: number;
    maxOutputTokens: number;
    knowledgeCutoff: string | null; // "YYYY-MM", null when unknown
}

export interface UserModelDto {
    id: string;
    modelName: string;
    description: string;
    capabilities: UserModelCapabilitiesDto;
}
