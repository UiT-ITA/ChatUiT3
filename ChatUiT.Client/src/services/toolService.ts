import { signal, Signal } from "@preact/signals-react";
import type { ChatToolDto } from "../types/assistantModels";
import apiService from "./apiService";

const toolsSignal = signal<ChatToolDto[] | undefined>(undefined);

let toolsLoadingPromise: Promise<void> | null = null;

export function getTools(): Signal<ChatToolDto[] | undefined> {
    if (toolsSignal.value === undefined && !toolsLoadingPromise) {
        loadTools();
    }
    return toolsSignal;
}

async function loadTools(): Promise<void> {
    if (toolsLoadingPromise) {
        return toolsLoadingPromise;
    }

    toolsLoadingPromise = (async () => {
        try {
            const response = await apiService<ChatToolDto[]>("/api/assistants/tools");
            toolsSignal.value = response;
        } catch (error) {
            console.error("Failed to load tools:", error);
            toolsSignal.value = [];
        } finally {
            toolsLoadingPromise = null;
        }
    })();

    return toolsLoadingPromise;
}

export async function refreshTools(): Promise<void> {
    toolsSignal.value = undefined;
    return loadTools();
}
