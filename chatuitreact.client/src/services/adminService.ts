import apiService from './apiService';
import type {
  EndpointDto,
  CreateEndpointDto,
  UpdateEndpointDto,
  ModelDto,
  CreateModelDto,
  UpdateModelDto,
  AdminAssistantDto,
  CreateAdminAssistantDto,
  UpdateAdminAssistantDto,
  AppSettingsDto,
  UpdateAppSettingsDto,
  CatalogModelDto,
  AdminToolDto,
  ToolAccessPolicyDto
} from '../types/admin';

export async function getEndpoints(): Promise<EndpointDto[]> {
  return apiService<EndpointDto[]>('/api/admin/endpoints');
}

export async function createEndpoint(data: CreateEndpointDto): Promise<EndpointDto> {
  return apiService.post<EndpointDto>('/api/admin/endpoints', data);
}

export async function updateEndpoint(id: string, data: UpdateEndpointDto): Promise<EndpointDto> {
  return apiService.put<EndpointDto>(`/api/admin/endpoints/${id}`, data);
}

export async function deleteEndpoint(id: string): Promise<void> {
  return apiService.delete<void>(`/api/admin/endpoints/${id}`);
}

export async function getModels(): Promise<ModelDto[]> {
  return apiService<ModelDto[]>('/api/admin/models');
}

export async function createModel(data: CreateModelDto): Promise<ModelDto> {
  return apiService.post<ModelDto>('/api/admin/models', data);
}

export async function updateModel(id: string, data: UpdateModelDto): Promise<ModelDto> {
  return apiService.put<ModelDto>(`/api/admin/models/${id}`, data);
}

export async function deleteModel(id: string): Promise<void> {
  return apiService.delete<void>(`/api/admin/models/${id}`);
}

export async function getAdminAssistants(): Promise<AdminAssistantDto[]> {
  return apiService<AdminAssistantDto[]>('/api/admin/assistants');
}

export async function getAdminAssistant(id: string): Promise<AdminAssistantDto> {
  return apiService<AdminAssistantDto>(`/api/admin/assistants/${id}`);
}

export async function createAdminAssistant(data: CreateAdminAssistantDto): Promise<AdminAssistantDto> {
  return apiService.post<AdminAssistantDto>('/api/admin/assistants', data);
}

export async function updateAdminAssistant(id: string, data: UpdateAdminAssistantDto): Promise<AdminAssistantDto> {
  return apiService.put<AdminAssistantDto>(`/api/admin/assistants/${id}`, data);
}

export async function deleteAdminAssistant(id: string): Promise<void> {
  return apiService.delete<void>(`/api/admin/assistants/${id}`);
}

export async function getAppSettings(): Promise<AppSettingsDto> {
  return apiService<AppSettingsDto>('/api/admin/settings');
}

export async function updateAppSettings(data: UpdateAppSettingsDto): Promise<AppSettingsDto> {
  return apiService.put<AppSettingsDto>('/api/admin/settings', data);
}

export async function getModelCatalog(): Promise<CatalogModelDto[]> {
  return apiService<CatalogModelDto[]>('/api/admin/model-catalog');
}

export async function getAdminTools(): Promise<AdminToolDto[]> {
  return apiService<AdminToolDto[]>('/api/admin/tools');
}

export async function getAdminTool(id: string): Promise<AdminToolDto> {
  return apiService<AdminToolDto>(`/api/admin/tools/${id}`);
}

export async function updateAdminToolPolicy(id: string, policy: ToolAccessPolicyDto): Promise<AdminToolDto> {
  return apiService.put<AdminToolDto>(`/api/admin/tools/${id}/policy`, policy);
}

/** Drops the stored override so the tool's code default applies again. */
export async function resetAdminToolPolicy(id: string): Promise<AdminToolDto> {
  return apiService.delete<AdminToolDto>(`/api/admin/tools/${id}/policy`);
}
