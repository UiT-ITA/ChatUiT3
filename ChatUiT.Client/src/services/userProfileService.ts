import { signal, Signal } from "@preact/signals-react";
import apiService from "./apiService";

/** What the user has told us about themselves. Read by prompt snippets an assistant owner enables. */
export interface UserProfile {
    displayName: string;
    jobRole: string;
    answerPreferences: string;
}

const PROFILE_ENDPOINT = "/api/users/me/profile";
const LEGACY_SETTINGS_KEY = "chatuit-settings";

const emptyProfile = (): UserProfile => ({ displayName: '', jobRole: '', answerPreferences: '' });

const userProfileSignal = signal<UserProfile | undefined>(undefined);

let loadingPromise: Promise<void> | null = null;

export function getUserProfile(): Signal<UserProfile | undefined> {
    if (userProfileSignal.value === undefined && !loadingPromise) {
        loadUserProfile();
    }
    return userProfileSignal;
}

async function loadUserProfile(): Promise<void> {
    if (loadingPromise) {
        return loadingPromise;
    }

    loadingPromise = (async () => {
        try {
            const server = await apiService<UserProfile>(PROFILE_ENDPOINT);
            const migrated = await migrateLegacyProfile(server);
            userProfileSignal.value = migrated ?? server;
        } catch (error) {
            console.error("Failed to load user profile:", error);
            userProfileSignal.value = emptyProfile();
        } finally {
            loadingPromise = null;
        }
    })();

    return loadingPromise;
}

export async function updateUserProfile(patch: Partial<UserProfile>): Promise<void> {
    const current = userProfileSignal.value ?? emptyProfile();
    const saved = await apiService.put<UserProfile>(PROFILE_ENDPOINT, { ...current, ...patch });
    userProfileSignal.value = saved;
}

const isEmptyProfile = (profile: UserProfile) =>
    !profile.displayName && !profile.jobRole && !profile.answerPreferences;

/**
 * These three fields used to live only in localStorage. The first time a user with an empty
 * server profile loads, their old values are pushed up once and removed locally.
 */
async function migrateLegacyProfile(server: UserProfile): Promise<UserProfile | null> {
    if (!isEmptyProfile(server)) {
        return null;
    }

    let stored: Record<string, unknown>;
    try {
        const raw = localStorage.getItem(LEGACY_SETTINGS_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) return null;
        stored = parsed as Record<string, unknown>;
    } catch {
        return null;
    }

    const text = (key: string) => {
        const value = stored[key];
        return typeof value === 'string' ? value.trim() : '';
    };
    const legacy: UserProfile = {
        displayName: text('userName'),
        jobRole: text('jobRole'),
        answerPreferences: text('customInstructions'),
    };
    if (isEmptyProfile(legacy)) {
        return null;
    }

    const saved = await apiService.put<UserProfile>(PROFILE_ENDPOINT, legacy);
    try {
        delete stored.userName;
        delete stored.jobRole;
        delete stored.customInstructions;
        localStorage.setItem(LEGACY_SETTINGS_KEY, JSON.stringify(stored));
    } catch {
        // Losing the cleanup only means the migration is re-checked next load; the server copy wins.
    }
    return saved;
}
