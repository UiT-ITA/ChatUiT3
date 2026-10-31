import type { ImageBackground, ImageFormat, ImageModeration, ImageQuality, ImageSize, ModelType } from './modelModels';

export type MediaGenerationStatus = 'Running' | 'Completed' | 'Failed' | 'Cancelled';

/** An output without its content, which is downloaded by id. `partialIndex` is set on an unfinished version. */
export interface MediaOutputDto {
  id: string;
  index: number;
  partialIndex: number | null;
  mediaType: string;
}

/** One run of a generation model for the user. */
export interface MediaGenerationDto {
  id: string;
  type: ModelType;
  /** The model row's id. */
  modelId: string;
  modelName: string;
  prompt: string;
  status: MediaGenerationStatus;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  outputs: MediaOutputDto[];
}

export type MediaGenerationEventKind = 'PartialOutput' | 'Output' | 'Usage' | 'Completed' | 'Failed' | 'Cancelled';

/** One event on a generation's live stream. Outputs are referenced by id. */
export interface MediaGenerationEvent {
  kind: MediaGenerationEventKind;
  elapsedMs: number;
  outputId: string | null;
  outputIndex: number | null;
  partialIndex: number | null;
  mediaType: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  error: string | null;
}

/** The settings of an image generation or edit. A null setting is left to the model. */
export interface ImageGenerationRequest {
  prompt: string;
  size: ImageSize | null;
  autoAspectRatio: boolean;
  quality: ImageQuality | null;
  count: number;
  outputFormat: ImageFormat | null;
  compression: number | null;
  background: ImageBackground | null;
  moderation: ImageModeration | null;
  partialImages: number;
  webGrounding: boolean;
}

/** A prompt to refine for an image model. isEdit means it describes changes to input images. */
export interface RefineImagePromptRequest {
  prompt: string;
  isEdit: boolean;
}

export interface RefineImagePromptResult {
  prompt: string;
}

/** The images an edit sends beside the settings. */
export interface ImageGenerationFiles {
  inputImages: File[];
  mask: File | null;
  markup: File | null;
}
