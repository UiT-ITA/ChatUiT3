import { signal, Signal } from "@preact/signals-react";
import type { KnowledgeSourceDto } from "../types/assistantModels";
import apiService from "./apiService";

const knowledgeSourcesSignal = signal<KnowledgeSourceDto[] | undefined>(undefined);

let knowledgeSourcesLoadingPromise: Promise<void> | null = null;

export function getKnowledgeSources(): Signal<KnowledgeSourceDto[] | undefined> {
    if (knowledgeSourcesSignal.value === undefined && !knowledgeSourcesLoadingPromise) {
        loadKnowledgeSources();
    }
    return knowledgeSourcesSignal;
}

async function loadKnowledgeSources(): Promise<void> {
    if (knowledgeSourcesLoadingPromise) {
        return knowledgeSourcesLoadingPromise;
    }

    knowledgeSourcesLoadingPromise = (async () => {
        try {
            const response = await apiService<KnowledgeSourceDto[]>("/api/knowledge-sources");
            knowledgeSourcesSignal.value = response;
        } catch (error) {
            console.error("Failed to load knowledge sources:", error);
            knowledgeSourcesSignal.value = [];
        } finally {
            knowledgeSourcesLoadingPromise = null;
        }
    })();

    return knowledgeSourcesLoadingPromise;
}
