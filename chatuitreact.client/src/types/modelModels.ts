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
    /**
     * Which key to read from message `tokenCounts` and assistant `promptTokenCounts`, and
     * how to count the draft. Null when the model has no counter.
     */
    tokenCountingScheme: string | null;
}

export interface UserModelDto {
    id: string;
    modelName: string;
    description: string;
    /** Whether an assistant on this model may be pinned as the user's default assistant. */
    allowedAsDefault: boolean;
    classification: DataClassification;
    capabilities: UserModelCapabilitiesDto;
}

/** Which data may be put into a model, function, toolbox, assistant or chat. Lowest first. */
export type DataClassification = 'Green' | 'Yellow' | 'Red';

export const DATA_CLASSIFICATIONS: DataClassification[] = ['Green', 'Yellow', 'Red'];

/** A chat follows its assistant, but is at most yellow until the user allows red. */
export function chatClassification(assistant: DataClassification, redEnabled: boolean): DataClassification {
    return redEnabled || assistant !== 'Red' ? assistant : 'Yellow';
}
