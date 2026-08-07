import { signal } from '@preact/signals-react';
import { getEndpoints, getModels, getAdminAssistants, getAppSettings } from './adminService';
import type { EndpointDto, ModelDto, AdminAssistantDto, AppSettingsDto } from '../types/admin';

// Shared admin lists — drive both the context column and the admin pages
export const adminEndpointsSignal = signal<EndpointDto[] | undefined>(undefined);
export const adminModelsSignal = signal<ModelDto[] | undefined>(undefined);
export const adminAssistantsSignal = signal<AdminAssistantDto[] | undefined>(undefined);
export const adminSettingsSignal = signal<AppSettingsDto | undefined>(undefined);

let loadStarted = false;

export async function loadAdminData(force = false): Promise<void> {
  if (loadStarted && !force) return;
  loadStarted = true;
  try {
    const [endpoints, models, assistants, settings] = await Promise.all([
      getEndpoints(),
      getModels(),
      getAdminAssistants(),
      getAppSettings(),
    ]);
    adminEndpointsSignal.value = endpoints ?? [];
    adminModelsSignal.value = models ?? [];
    adminAssistantsSignal.value = assistants ?? [];
    adminSettingsSignal.value = settings ?? { defaultModelId: '', chatNamingModelId: '' };
  } catch (error) {
    console.error('Failed to load admin data:', error);
    if (!force) loadStarted = false;
  }
}
