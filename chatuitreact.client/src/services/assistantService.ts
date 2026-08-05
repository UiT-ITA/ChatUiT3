import { signal, Signal, computed } from "@preact/signals-react";
import type { AssistantDto, AssistantFileDto, CreateAssistantDto, UpdateAssistantDto, AssistantListDto } from "../types/assistantModels";
import apiService from "./apiService";

// Assistant file content is loaded on demand (assistants carry file metadata only).
const assistantFileCache = new Map<string, Promise<AssistantFileDto>>();

export function fetchAssistantFile(assistantId: string, fileId: string): Promise<AssistantFileDto> {
    const cacheKey = `${assistantId}/${fileId}`;
    let pending = assistantFileCache.get(cacheKey);

    if (!pending) {
        pending = apiService<AssistantFileDto>(`/api/Assistants/${assistantId}/files/${fileId}`);
        assistantFileCache.set(cacheKey, pending);
        pending.catch(() => assistantFileCache.delete(cacheKey));
    }

    return pending;
}

const assistantListSignal = signal<AssistantListDto | undefined>(undefined);

let assistantListLoadingPromise: Promise<void> | null = null;

export function getAssistants(): Signal<AssistantListDto | undefined> {
    if (assistantListSignal.value === undefined && !assistantListLoadingPromise) {
        invalidateAssistants();
    }
    return assistantListSignal;
}

export async function invalidateAssistants(): Promise<void> {
    if (assistantListLoadingPromise) {
        return assistantListLoadingPromise;
    }

    assistantListLoadingPromise = (async () => {
        try {
            const response = await apiService<AssistantListDto>("/api/Assistants");
            assistantListSignal.value = response;
        } catch (error) {
            console.error("Failed to invalidate assistants:", error);
            assistantListSignal.value = { owned: [], system: [], shared: [] };
        } finally {
            assistantListLoadingPromise = null;
        }
    })();

    return assistantListLoadingPromise;
}

export function getAssistant(assistantId: string): Signal<AssistantDto | undefined> {
    return computed(() => {
        const list = assistantListSignal.value;

        if (list === undefined) {
            return undefined;
        }

        const foundAssistant =
            list.owned.find(a => a.id === assistantId) ||
            list.system.find(a => a.id === assistantId) ||
            list.shared.find(a => a.id === assistantId);

        if (foundAssistant) {
            const type: AssistantDto["type"] = list.system.some(a => a.id === assistantId)
                ? 'system'
                : (list.shared.some(a => a.id === assistantId) ? 'shared' : 'owned');
            return { ...(foundAssistant as any), type } as AssistantDto;
        }
        return undefined;
    });
}

export async function createAssistant(assistant: CreateAssistantDto): Promise<AssistantDto> {
    try {
        const response = await apiService<AssistantDto>("/api/Assistants", {
            method: 'POST',
            body: JSON.stringify(assistant),
        });
        return response;
    } catch (error) {
        console.error("Failed to create assistant:", error);
        throw error;
    }
}

export async function updateAssistant(assistant: UpdateAssistantDto): Promise<AssistantDto> {
    try {
        const response = await apiService<AssistantDto>("/api/Assistants", {
            method: 'PUT',
            body: JSON.stringify(assistant),
        });
        return response;
    } catch (error) {
        console.error("Failed to update assistant:", error);
        throw error;
    }
}

export async function deleteAssistant(id: string): Promise<void> {
    try {
        await apiService(`/api/Assistants/${id}`, {
            method: 'DELETE',
        });
    } catch (error) {
        console.error(`Failed to delete assistant with ID ${id}:`, error);
        throw error;
    }
}

export async function toggleVisibility(id: string): Promise<void> {
    try {
        await apiService(`/api/Assistants/${id}/visibility`, {
            method: 'POST',
        });
    } catch (error) {
        console.error(`Failed to toggle visibility for assistant with ID ${id}:`, error);
        throw error;
    }
}

export async function addSharedAssistant(assistantId: string): Promise<void> {
    try {
        await apiService(`/api/Assistants/shared/${assistantId}`, {
            method: 'POST',
        });
    } catch (error) {
        console.error(`Failed to add shared assistant with ID ${assistantId}:`, error);
        throw error;
    }
}

export async function removeSharedAssistant(assistantId: string): Promise<void> {
    try {
        await apiService(`/api/Assistants/shared/${assistantId}`, {
            method: 'DELETE',
        });
    } catch (error) {
        console.error(`Failed to remove shared assistant with ID ${assistantId}:`, error);
        throw error;
    }
}
