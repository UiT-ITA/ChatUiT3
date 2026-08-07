import type { FullAssistantDto, CreateAssistantDto, UpdateAssistantDto } from './assistantModels';

export type EndpointType = 'AzureOpenAI' | 'OpenAI' | 'Anthropic' | 'LlamaCpp' | 'Other';

export interface EndpointDto {
  id: string;
  url: string;
  endpointType: EndpointType;
}

export interface CreateEndpointDto {
  url: string;
  apiKey: string;
  endpointType: EndpointType;
}

export interface UpdateEndpointDto {
  id: string;
  url: string;
  apiKey: string;
  endpointType: EndpointType;
}

export type UserRole = 'User' | 'Admin' | 'Beta' | 'Super' | 'External';

export interface ModelCapabilities {
  supportsVision: boolean;
  supportsReasoning: boolean;
  supportsFunctionCalling: boolean;
  supportsTemperature: boolean;
  maxContextLength: number;
  maxOutputLength: number;
  knowledgeCutoff: string; // ISO date string
}

export interface ModelDto {
  id: string;
  modelId: string;      // Provider model identifier (e.g. "gpt-4o")
  modelName: string;    // Friendly/display name
  description: string;
  endpointId: string;
  allowedRoles: UserRole[];
  capabilities: ModelCapabilities;
}

export interface CreateModelDto {
  modelId: string;      // Provider model identifier
  modelName: string;    // Friendly/display name
  description: string;
  endpointId: string;
  allowedRoles: UserRole[];
  capabilities: ModelCapabilities;
}

export interface UpdateModelDto {
  id: string;
  modelId: string;      // Provider model identifier
  modelName: string;    // Friendly/display name
  description: string;
  endpointId: string;
  allowedRoles: UserRole[];
  capabilities: ModelCapabilities;
}

export interface AppSettingsDto {
  defaultModelId: string;      // Model.id preselected when creating assistants
  chatNamingModelId: string;   // Model.id used to name new chats
}

export interface UpdateAppSettingsDto {
  defaultModelId: string;
  chatNamingModelId: string;
}

export type AdminAssistantDto = FullAssistantDto;
export type CreateAdminAssistantDto = CreateAssistantDto;
export type UpdateAdminAssistantDto = UpdateAssistantDto;
