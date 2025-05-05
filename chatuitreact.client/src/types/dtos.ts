// DTOs (Data Transfer Objects) for API communication

// Endpoint DTOs
export interface EndpointDto {
  id: string;
  url: string;
}

export interface CreateEndpointDto {
  url: string;
  apiKey: string;
}

export interface UpdateEndpointDto {
  id: string;
  url: string;
  apiKey: string;
}

// Model Capabilities DTO
export interface ModelCapabilitiesDto {
  supportsVision: boolean;
  supportsReasoning: boolean;
  supportsFunctionCalling: boolean;
  supportsCodeInterpreter: boolean;
  maxContextLength: number;
  maxOutputLength: number;
}

// Model DTOs
export interface ModelDto {
  id: string;
  name: string;
  description: string;
  modelId: string;
  modelType: string;
  endpoint: EndpointDto;
  capabilities: ModelCapabilitiesDto;
}

// Assistant Settings
export interface AiModelSettings {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  reasoningEffort: string;
}

// Assistant DTOs
export interface AssistantDto {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  ownerId: string;
  sharedWithUserIds: string[];
  model: ModelDto;
  modelSettings: AiModelSettings;
  toolIds: string[];
  preloadedDocumentIds: string[];
}

export interface CreateAssistantDto {
  name: string;
  description: string;
  systemPrompt: string;
  sharedWithUserIds: string[];
  modelId: string;
  modelSettings: AiModelSettings;
  toolIds: string[];
  preloadedDocumentIds: string[];
}

export interface UpdateAssistantDto {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  sharedWithUserIds: string[];
  modelId: string;
  modelSettings: AiModelSettings;
  toolIds: string[];
  preloadedDocumentIds: string[];
}

export interface CreateModelDto {
  name: string;
  description: string;
  modelId: string;
  modelType: string;
  endpointId: string;
  capabilities: ModelCapabilitiesDto;
}

export interface UpdateModelDto {
  id: string;
  name: string;
  description: string;
  modelId: string;
  modelType: string;
  endpointId: string;
  capabilities: ModelCapabilitiesDto;
}
