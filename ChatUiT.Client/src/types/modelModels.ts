import type { ReasoningEffortLevel, TemperatureSupport } from './admin';

/** What a model produces. Each type has its own model DTO and capabilities. */
export type ModelType = 'Language' | 'Image' | 'Voice';

export const MODEL_TYPES: ModelType[] = ['Language', 'Image', 'Voice'];

/**
 * The user-facing view of a language model. Deliberately narrower than the admin `LanguageModelDto`:
 * it drives which controls the assistant form shows and carries no endpoint detail.
 */
export interface UserLanguageModelCapabilitiesDto {
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

export interface UserLanguageModelDto {
    id: string;
    modelName: string;
    description: string;
    /** Whether an assistant on this model may be pinned as the user's default assistant. */
    allowedAsDefault: boolean;
    classification: DataClassification;
    capabilities: UserLanguageModelCapabilitiesDto;
}

/** Which data may be put into a model, function, toolbox, assistant or chat. Lowest first. */
export type DataClassification = 'Green' | 'Yellow' | 'Red';

export const DATA_CLASSIFICATIONS: DataClassification[] = ['Green', 'Yellow', 'Red'];

/** A chat follows its assistant, but is at most yellow until the user allows red. */
export function chatClassification(assistant: DataClassification, redEnabled: boolean): DataClassification {
    return redEnabled || assistant !== 'Red' ? assistant : 'Yellow';
}

/** The wire API an image model is called with. */
export type ImageApi = 'OpenAiImages' | 'MaiImages';

export const IMAGE_APIS: ImageApi[] = ['OpenAiImages', 'MaiImages'];

export type ImageQuality = 'Auto' | 'Low' | 'Medium' | 'High' | 'XHigh' | 'Max';

export const IMAGE_QUALITIES: ImageQuality[] = ['Auto', 'Low', 'Medium', 'High', 'XHigh', 'Max'];

export type ImageFormat = 'Png' | 'Jpeg' | 'Webp';

export const IMAGE_FORMATS: ImageFormat[] = ['Png', 'Jpeg', 'Webp'];

export type ImageBackground = 'Auto' | 'Opaque' | 'Transparent';

export const IMAGE_BACKGROUNDS: ImageBackground[] = ['Auto', 'Opaque', 'Transparent'];

export type ImageModeration = 'Auto' | 'Low';

export const IMAGE_MODERATION_LEVELS: ImageModeration[] = ['Auto', 'Low'];

export interface ImageSize {
    width: number;
    height: number;
}

export interface ImageEditCapabilities {
    maxInputImages: number;
    inputFormats: ImageFormat[];
    maxInputImageBytes: number | null;
    /** A PNG mask with an alpha channel marks the area to change in the first image. */
    supportsMask: boolean;
    /** A transparent PNG drawn over the first image shows what to change. Not together with a mask. */
    supportsMarkup: boolean;
    /** When false an edit takes the prompt and the images only. */
    acceptsGenerationSettings: boolean;
}

/** What an image model supports. A null limit means the model has none. Mirrors the server's ImageModelCapabilities. */
export interface ImageModelCapabilities {
    sizePresets: ImageSize[];
    supportsAutoSize: boolean;
    supportsCustomSize: boolean;
    sizeMultiple: number | null;
    minSide: number | null;
    maxSide: number | null;
    minPixels: number | null;
    maxPixels: number | null;
    maxAspectRatio: number | null;
    supportsAutoAspectRatio: boolean;
    /** Empty means the model has no quality setting. */
    qualities: ImageQuality[];
    maxImagesPerRequest: number;
    /** The first is used when none is asked for. */
    outputFormats: ImageFormat[];
    supportsCompression: boolean;
    backgrounds: ImageBackground[];
    moderationLevels: ImageModeration[];
    /** 0 means the model does not stream partial images. */
    maxPartialImages: number;
    supportsWebGrounding: boolean;
    maxPromptCharacters: number | null;
    /** Null when the model cannot edit images. */
    editing: ImageEditCapabilities | null;
}

/** An image model as a user sees it. */
export interface UserImageModelDto {
    id: string;
    modelName: string;
    description: string;
    capabilities: ImageModelCapabilities;
}
