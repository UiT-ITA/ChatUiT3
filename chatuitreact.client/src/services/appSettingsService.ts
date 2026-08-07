import { signal, Signal } from "@preact/signals-react";
import apiService from "./apiService";

// The subset of the admin app settings that every signed-in user may read
export interface AppDefaults {
    defaultModelId: string;
}

const appDefaultsSignal = signal<AppDefaults | undefined>(undefined);

let loadingPromise: Promise<void> | null = null;

export function getAppDefaults(): Signal<AppDefaults | undefined> {
    if (appDefaultsSignal.value === undefined && !loadingPromise) {
        loadAppDefaults();
    }
    return appDefaultsSignal;
}

async function loadAppDefaults(): Promise<void> {
    if (loadingPromise) {
        return loadingPromise;
    }

    loadingPromise = (async () => {
        try {
            const response = await apiService<AppDefaults>("/api/app-settings");
            appDefaultsSignal.value = response;
        } catch (error) {
            console.error("Failed to load app defaults:", error);
            appDefaultsSignal.value = { defaultModelId: '' };
        } finally {
            loadingPromise = null;
        }
    })();

    return loadingPromise;
}

export async function refreshAppDefaults(): Promise<void> {
    appDefaultsSignal.value = undefined;
    return loadAppDefaults();
}
