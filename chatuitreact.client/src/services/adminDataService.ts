import { signal } from '@preact/signals-react';
import { getEndpoints, getModels, getAdminAssistants } from './adminService';
import type { EndpointDto, ModelDto, AdminAssistantDto } from '../types/admin';

// Shared admin lists — drive both the context column and the admin pages
export const adminEndpointsSignal = signal<EndpointDto[] | undefined>(undefined);
export const adminModelsSignal = signal<ModelDto[] | undefined>(undefined);
export const adminAssistantsSignal = signal<AdminAssistantDto[] | undefined>(undefined);

let loadStarted = false;

export async function loadAdminData(force = false): Promise<void> {
  if (loadStarted && !force) return;
  loadStarted = true;
  try {
    const [endpoints, models, assistants] = await Promise.all([
      getEndpoints(),
      getModels(),
      getAdminAssistants(),
    ]);
    adminEndpointsSignal.value = endpoints ?? [];
    adminModelsSignal.value = models ?? [];
    adminAssistantsSignal.value = assistants ?? [];
  } catch (error) {
    console.error('Failed to load admin data:', error);
    if (!force) loadStarted = false;
  }
}
