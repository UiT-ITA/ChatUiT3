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
            assistantListSignal.value = { owned: [], system: [], shared: [], defaultAssistantId: null };
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

// Pinning only ever flips one field, so both of these apply it locally first and put the old
// value back if the request fails. The server's AssistantsUpdated push reconciles the list
// afterwards, so the pin reacts without waiting for that round trip.
function applyDefaultAssistantLocally(id: string | null): string | null | undefined {
    const current = assistantListSignal.value;
    if (!current) return undefined;

    const previous = current.defaultAssistantId;
    assistantListSignal.value = { ...current, defaultAssistantId: id };
    return previous;
}

function revertDefaultAssistant(previous: string | null | undefined): void {
    if (previous === undefined) return;

    const current = assistantListSignal.value;
    if (current) {
        assistantListSignal.value = { ...current, defaultAssistantId: previous };
    }
}

export async function setDefaultAssistant(id: string): Promise<void> {
    const previous = applyDefaultAssistantLocally(id);

    try {
        await apiService(`/api/Assistants/${id}/default`, {
            method: 'POST',
        });
    } catch (error) {
        revertDefaultAssistant(previous);
        console.error(`Failed to set default assistant with ID ${id}:`, error);
        throw error;
    }
}

export async function clearDefaultAssistant(): Promise<void> {
    const previous = applyDefaultAssistantLocally(null);

    try {
        await apiService('/api/Assistants/default', {
            method: 'DELETE',
        });
    } catch (error) {
        revertDefaultAssistant(previous);
        console.error("Failed to clear default assistant:", error);
        throw error;
    }
}

/**
 * Flips isFavorite in the cached list first so the star reacts immediately, then
 * writes to the server. The server's AssistantsUpdated push refetches the list
 * and confirms it; a failure rolls the local flip back.
 */
export async function toggleFavorite(id: string): Promise<void> {
    const apply = (isFavorite: boolean) => {
        const list = assistantListSignal.value;
        if (!list) return;

        const set = <T extends { id: string; isFavorite: boolean }>(assistants: T[]): T[] =>
            assistants.map(a => (a.id === id ? { ...a, isFavorite } : a));

        assistantListSignal.value = {
            ...list,
            owned: set(list.owned),
            system: set(list.system),
            shared: set(list.shared),
        };
    };

    const list = assistantListSignal.value;
    const current = [...(list?.owned ?? []), ...(list?.system ?? []), ...(list?.shared ?? [])]
        .find(a => a.id === id)?.isFavorite ?? false;

    apply(!current);

    try {
        await apiService(`/api/Assistants/${id}/favorite`, {
            method: 'POST',
        });
    } catch (error) {
        apply(current);
        console.error(`Failed to toggle favorite for assistant with ID ${id}:`, error);
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
