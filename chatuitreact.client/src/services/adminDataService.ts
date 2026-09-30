import { signal } from '@preact/signals-react';
import { getEndpoints, getModels, getAdminAssistants, getAppSettings, getAdminTools, getAdminApiCatalog, getAdminInternalAgents } from './adminService';
import type { EndpointDto, ModelDto, AdminAssistantDto, AppSettingsDto, AdminToolDto, ApiCatalogDto, InternalAgentDto } from '../types/admin';

// Shared admin lists — drive both the context column and the admin pages
export const adminEndpointsSignal = signal<EndpointDto[] | undefined>(undefined);
export const adminModelsSignal = signal<ModelDto[] | undefined>(undefined);
export const adminAssistantsSignal = signal<AdminAssistantDto[] | undefined>(undefined);
export const adminSettingsSignal = signal<AppSettingsDto | undefined>(undefined);
export const adminToolsSignal = signal<AdminToolDto[] | undefined>(undefined);
export const adminApiCatalogSignal = signal<ApiCatalogDto | undefined>(undefined);
export const adminInternalAgentsSignal = signal<InternalAgentDto[] | undefined>(undefined);

let loadStarted = false;

export async function loadAdminData(force = false): Promise<void> {
  if (loadStarted && !force) return;
  loadStarted = true;
  try {
    const [endpoints, models, assistants, settings, tools, apiCatalog, internalAgents] = await Promise.all([
      getEndpoints(),
      getModels(),
      getAdminAssistants(),
      getAppSettings(),
      getAdminTools(),
      getAdminApiCatalog(),
      getAdminInternalAgents(),
    ]);
    adminToolsSignal.value = tools ?? [];
    adminApiCatalogSignal.value = apiCatalog ?? { entries: [], agents: [], models: [] };
    adminInternalAgentsSignal.value = internalAgents ?? [];
    adminEndpointsSignal.value = endpoints ?? [];
    adminModelsSignal.value = models ?? [];
    adminAssistantsSignal.value = assistants ?? [];
    adminSettingsSignal.value = settings ?? { defaultModelId: '', chatNamingModelId: '', defaultAssistantId: '' };
  } catch (error) {
    console.error('Failed to load admin data:', error);
    if (!force) loadStarted = false;
  }
}
