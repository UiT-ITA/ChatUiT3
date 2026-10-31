import { signal, type Signal } from "@preact/signals-react";
import apiService from "./apiService";
import type { UserImageModelDto } from "../types/modelModels";
import type {
  ImageGenerationFiles,
  ImageGenerationRequest,
  MediaGenerationDto,
  MediaGenerationEvent,
  MediaOutputDto,
  RefineImagePromptRequest,
  RefineImagePromptResult,
} from "../types/mediaGenerationModels";

/** A generation as the page shows it: the server's record plus an object URL for each downloaded output. */
export interface MediaGenerationState extends MediaGenerationDto {
  outputUrls: Record<string, string>;
}

const imageModelsSignal = signal<UserImageModelDto[] | undefined>(undefined);
const generationsSignal = signal<MediaGenerationState[] | undefined>(undefined);

let imageModelsLoading: Promise<void> | null = null;
let generationsLoading: Promise<void> | null = null;
let streamGenerationCallback: ((generationId: string) => void) | null = null;

/** Set by the hub connection: asks the server to send a generation's events, from the first. */
export function setStreamGenerationCallback(callback: (generationId: string) => void): void {
  streamGenerationCallback = callback;
}

/** The image models the user may use. Loads on first read. */
export function getImageModels(): Signal<UserImageModelDto[] | undefined> {
  if (imageModelsSignal.value === undefined && !imageModelsLoading) {
    imageModelsLoading = apiService<UserImageModelDto[]>("/api/media-generations/image-models")
      .then(models => { imageModelsSignal.value = models; })
      .catch(error => {
        console.error("Failed to load image models:", error);
        imageModelsSignal.value = [];
      })
      .finally(() => { imageModelsLoading = null; });
  }
  return imageModelsSignal;
}

/**
 * The user's generations, newest first. Loads on first read: running ones are streamed from the
 * start, finished ones have their outputs downloaded.
 */
export function getGenerations(): Signal<MediaGenerationState[] | undefined> {
  if (generationsSignal.value === undefined && !generationsLoading) {
    generationsLoading = apiService<MediaGenerationDto[]>("/api/media-generations")
      .then(generations => {
        generationsSignal.value = generations.map(g => ({ ...g, outputUrls: {} }));
        for (const generation of generations) {
          if (generation.status === "Running") {
            streamGenerationCallback?.(generation.id);
          } else {
            for (const output of visibleOutputs(generation.outputs)) {
              void downloadOutput(generation.id, output.id);
            }
          }
        }
      })
      .catch(error => {
        console.error("Failed to load generations:", error);
        generationsSignal.value = [];
      })
      .finally(() => { generationsLoading = null; });
  }
  return generationsSignal;
}

/** Starts an image generation, or an edit when input images are given. Resolves once the server has accepted it. */
export async function startImageGeneration(modelId: string, request: ImageGenerationRequest, files: ImageGenerationFiles): Promise<MediaGenerationDto> {
  const form = new FormData();
  form.append("request", JSON.stringify(request));
  for (const image of files.inputImages) {
    form.append("inputImages", image, image.name);
  }
  if (files.mask) form.append("mask", files.mask, files.mask.name);
  if (files.markup) form.append("markup", files.markup, files.markup.name);

  const generation = await apiService.postForm<MediaGenerationDto>(`/api/media-generations/image-models/${encodeURIComponent(modelId)}/generations`, form);
  generationsSignal.value = [{ ...generation, outputUrls: {} }, ...(generationsSignal.value ?? [])];
  streamGenerationCallback?.(generation.id);
  return generation;
}

/** Rewrites a prompt for an image model with the default language model. */
export async function refineImagePrompt(modelId: string, request: RefineImagePromptRequest): Promise<string> {
  const result = await apiService.post<RefineImagePromptResult>(`/api/media-generations/image-models/${encodeURIComponent(modelId)}/refine-prompt`, request);
  return result.prompt;
}

/** Asks the server again for the events of every running generation, after the hub has reconnected. */
export function resumeGenerationStreams(): void {
  for (const generation of generationsSignal.value ?? []) {
    if (generation.status === "Running") streamGenerationCallback?.(generation.id);
  }
}

export async function cancelGeneration(generationId: string): Promise<void> {
  await apiService.post<void>(`/api/media-generations/${generationId}/cancel`, {});
}

/** Applies one event from the hub. Replayed events for outputs already known are ignored. A failure removes the partial outputs. */
export function receiveMediaGenerationEvent(generationId: string, event: MediaGenerationEvent): void {
  switch (event.kind) {
    case "PartialOutput":
    case "Output": {
      if (!event.outputId || event.outputIndex === null || !event.mediaType) return;
      const output: MediaOutputDto = {
        id: event.outputId,
        index: event.outputIndex,
        partialIndex: event.kind === "PartialOutput" ? event.partialIndex : null,
        mediaType: event.mediaType,
      };
      update(generationId, g => g.outputs.some(o => o.id === output.id) ? g : { ...g, outputs: [...g.outputs, output] });
      void downloadOutput(generationId, output.id);
      break;
    }
    case "Usage":
      update(generationId, g => ({ ...g, inputTokens: event.inputTokens, outputTokens: event.outputTokens }));
      break;
    case "Completed":
      update(generationId, g => ({ ...g, status: "Completed", finishedAt: g.finishedAt ?? new Date().toISOString() }));
      break;
    case "Failed":
      update(generationId, g => ({
        ...g,
        status: "Failed",
        error: event.error,
        finishedAt: g.finishedAt ?? new Date().toISOString(),
        outputs: g.outputs.filter(o => o.partialIndex === null),
      }));
      break;
    case "Cancelled":
      update(generationId, g => ({ ...g, status: "Cancelled", finishedAt: g.finishedAt ?? new Date().toISOString() }));
      break;
  }
}

/** For each output index, the finished output, or the latest partial one while it is not done. */
export function visibleOutputs(outputs: MediaOutputDto[]): MediaOutputDto[] {
  const byIndex = new Map<number, MediaOutputDto>();
  for (const output of outputs) {
    const current = byIndex.get(output.index);
    const isNewer = !current
      || (current.partialIndex !== null && output.partialIndex === null)
      || (current.partialIndex !== null && output.partialIndex !== null && output.partialIndex > current.partialIndex);
    if (isNewer) byIndex.set(output.index, output);
  }
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

/** Whether the output is one the generation shows: not removed by a failure, nor replaced by a later version. */
function isVisible(generation: MediaGenerationState | undefined, outputId: string): boolean {
  return !!generation && visibleOutputs(generation.outputs).some(o => o.id === outputId);
}

/** Downloads an output the generation shows. One that stopped being shown meanwhile is dropped. */
async function downloadOutput(generationId: string, outputId: string): Promise<void> {
  const current = () => generationsSignal.value?.find(g => g.id === generationId);
  if (current()?.outputUrls[outputId] || !isVisible(current(), outputId)) return;
  try {
    const blob = await apiService.getBlob(`/api/media-generations/${generationId}/outputs/${outputId}`);
    const url = URL.createObjectURL(blob);
    if (!isVisible(current(), outputId)) {
      URL.revokeObjectURL(url);
      return;
    }
    update(generationId, g => ({ ...g, outputUrls: { ...g.outputUrls, [outputId]: url } }));
  } catch (error) {
    console.error(`Failed to download output ${outputId} of generation ${generationId}:`, error);
  }
}

/** Replaces one known generation, and releases the downloads of outputs it no longer shows. */
function update(generationId: string, change: (generation: MediaGenerationState) => MediaGenerationState): void {
  const list = generationsSignal.value ?? [];
  const index = list.findIndex(g => g.id === generationId);
  if (index === -1) return;
  const changed = change(list[index]);
  const shown = new Set(visibleOutputs(changed.outputs).map(o => o.id));
  const outputUrls = { ...changed.outputUrls };
  for (const [outputId, url] of Object.entries(outputUrls)) {
    if (shown.has(outputId)) continue;
    URL.revokeObjectURL(url);
    delete outputUrls[outputId];
  }
  const next = [...list];
  next[index] = { ...changed, outputUrls };
  generationsSignal.value = next;
}
