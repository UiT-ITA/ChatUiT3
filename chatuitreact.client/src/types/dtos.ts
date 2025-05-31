// User roles enum
export enum UserRole {
  User = 'User',
  Admin = 'Admin',
  Beta = 'Beta', 
  Super = 'Super',
  External = 'External'
}

// Endpoint DTOs
export interface EndpointDto {
  id: string;
  url: string;
  endpointType: string;
}

export interface CreateEndpointDto {
  url: string;
  apiKey: string;
  endpointType: string;
}

export interface UpdateEndpointDto {
  id: string;
  url: string;
  apiKey: string;
  endpointType: string;
}

// Model DTOs
export interface ModelDto {
  id: string;
  modelName: string;
  endpointId: string;
  allowedRoles: UserRole[];
}

export interface CreateModelDto {
  modelName: string;
  endpointId: string;
  allowedRoles: UserRole[];
}

export interface UpdateModelDto {
  id: string;
  modelName: string;
  endpointId: string;
  allowedRoles: UserRole[];
}

// Assistant DTOs
export interface AssistantListDto {
  owned: PrivateAssistantDto[];
  system: SystemAssistantDto[];
  shared: SharedAssistantDto[];
}

export interface PrivateAssistantDto {
  id: string;
  name: string;
  description: string;
  tags: string[];
  model: ModelDto;
  systemPrompt: string;
  temperature: number;
  reasoningEffort: ReasoningEffort;
  isVisible: boolean;
}

export interface SystemAssistantDto {
  id: string;
  name: string;
  description: string;
  tags: string[];
  modelName: string;
  isVisible: boolean;
}

export interface SharedAssistantDto {
  id: string;
  name: string;
  description: string;
  tags: string[];
  modelName: string;
  isVisible: boolean;
}

export interface CreateAssistantDto {
  name: string;
  description: string;
  tags: string[];
  modelId: string;
  systemPrompt: string;
  temperature: number;
  reasoningEffort: ReasoningEffort;
}

export interface UpdateAssistantDto {
  id: string;
  name: string;
  description: string;
  tags: string[];
  modelId: string;
  systemPrompt: string;
  temperature: number;
  reasoningEffort: ReasoningEffort;
}

export enum ReasoningEffort {
  None = 'None',
  Low = 'Low',
  Medium = 'Medium',
  High = 'High'
}

// Union type for any assistant
export type AnyAssistantDto = PrivateAssistantDto | SystemAssistantDto | SharedAssistantDto;
