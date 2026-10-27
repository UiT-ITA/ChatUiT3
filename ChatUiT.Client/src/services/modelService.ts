import { signal, Signal } from "@preact/signals-react";
import type { UserModelDto } from "../types/modelModels";
import apiService from "./apiService";

const modelsSignal = signal<UserModelDto[] | undefined>(undefined);

let modelsLoadingPromise: Promise<void> | null = null;

export function getModels(): Signal<UserModelDto[] | undefined> {
    if (modelsSignal.value === undefined && !modelsLoadingPromise) {
        loadModels();
    }
    return modelsSignal;
}

async function loadModels(): Promise<void> {
    if (modelsLoadingPromise) {
        return modelsLoadingPromise;
    }

    modelsLoadingPromise = (async () => {
        try {
            const response = await apiService<UserModelDto[]>("/api/Assistants/models");
            modelsSignal.value = response;
        } catch (error) {
            console.error("Failed to load models:", error);
            modelsSignal.value = [];
        } finally {
            modelsLoadingPromise = null;
        }
    })();

    return modelsLoadingPromise;
}

export async function refreshModels(): Promise<void> {
    modelsSignal.value = undefined;
    return loadModels();
}
