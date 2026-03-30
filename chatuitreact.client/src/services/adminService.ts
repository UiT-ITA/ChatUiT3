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
  UpdateAdminAssistantDto
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
