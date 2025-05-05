import { AiModel, AiModelEndpoint, AiModelType } from '../types/aiModels';
import { 
  EndpointDto, 
  CreateEndpointDto, 
  UpdateEndpointDto, 
  ModelDto,
  CreateModelDto,
  UpdateModelDto,
  ModelCapabilitiesDto,
  AssistantDto,
  CreateAssistantDto,
  UpdateAssistantDto,
  AiModelSettings
} from '../types/dtos';
import authService from './authService';

// Base API URL
const API_BASE_URL = '/api/admin';

// Helper function to get authorization headers
const getAuthHeaders = async (): Promise<HeadersInit> => {
  const token = await authService.getAccessToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// Helper functions to convert between DTOs and domain models
const toAiModelEndpoint = (dto: EndpointDto): AiModelEndpoint => {
  return {
    id: dto.id,
    url: dto.url,
    apiKey: '' // API key is not returned from the server
  };
};

const toCreateEndpointDto = (endpoint: AiModelEndpoint): CreateEndpointDto => {
  return {
    url: endpoint.url,
    apiKey: endpoint.apiKey
  };
};

const toUpdateEndpointDto = (endpoint: AiModelEndpoint): UpdateEndpointDto => {
  return {
    id: endpoint.id,
    url: endpoint.url,
    apiKey: endpoint.apiKey
  };
};

const toAiModel = (dto: ModelDto): AiModel => {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    modelId: dto.modelId,
    modelType: dto.modelType as AiModelType,
    endpoint: toAiModelEndpoint(dto.endpoint),
    capabilities: {
      supportsVision: dto.capabilities.supportsVision,
      supportsReasoning: dto.capabilities.supportsReasoning,
      supportsFunctionCalling: dto.capabilities.supportsFunctionCalling,
      supportsCodeInterpreter: dto.capabilities.supportsCodeInterpreter,
      maxContextLength: dto.capabilities.maxContextLength,
      maxOutputLength: dto.capabilities.maxOutputLength
    }
  };
};

const toCreateModelDto = (model: AiModel): CreateModelDto => {
  return {
    name: model.name,
    description: model.description,
    modelId: model.modelId,
    modelType: model.modelType.toString(),
    endpointId: model.endpoint.id,
    capabilities: {
      supportsVision: model.capabilities.supportsVision,
      supportsReasoning: model.capabilities.supportsReasoning,
      supportsFunctionCalling: model.capabilities.supportsFunctionCalling,
      supportsCodeInterpreter: model.capabilities.supportsCodeInterpreter,
      maxContextLength: model.capabilities.maxContextLength,
      maxOutputLength: model.capabilities.maxOutputLength
    }
  };
};

const toUpdateModelDto = (model: AiModel): UpdateModelDto => {
  return {
    id: model.id,
    name: model.name,
    description: model.description,
    modelId: model.modelId,
    modelType: model.modelType.toString(),
    endpointId: model.endpoint.id,
    capabilities: {
      supportsVision: model.capabilities.supportsVision,
      supportsReasoning: model.capabilities.supportsReasoning,
      supportsFunctionCalling: model.capabilities.supportsFunctionCalling,
      supportsCodeInterpreter: model.capabilities.supportsCodeInterpreter,
      maxContextLength: model.capabilities.maxContextLength,
      maxOutputLength: model.capabilities.maxOutputLength
    }
  };
};

// Endpoints CRUD operations
const getAllEndpoints = async (): Promise<AiModelEndpoint[]> => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/endpoints`, {
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    const dtos = await response.json() as EndpointDto[];
    return dtos.map(dto => toAiModelEndpoint(dto));
  } catch (error) {
    console.error('Failed to fetch endpoints:', error);
    throw error;
  }
};

const getEndpoint = async (id: string): Promise<AiModelEndpoint> => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/endpoints/${id}`, {
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    const dto = await response.json() as EndpointDto;
    return toAiModelEndpoint(dto);
  } catch (error) {
    console.error(`Failed to fetch endpoint ${id}:`, error);
    throw error;
  }
};

const createEndpoint = async (endpoint: AiModelEndpoint): Promise<AiModelEndpoint> => {
  try {
    const headers = await getAuthHeaders();
    const dto = toCreateEndpointDto(endpoint);
    
    const response = await fetch(`${API_BASE_URL}/endpoints`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dto),
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    const createdDto = await response.json() as EndpointDto;
    return toAiModelEndpoint(createdDto);
  } catch (error) {
    console.error('Failed to create endpoint:', error);
    throw error;
  }
};

const updateEndpoint = async (id: string, endpoint: AiModelEndpoint): Promise<void> => {
  try {
    const headers = await getAuthHeaders();
    const dto = toUpdateEndpointDto(endpoint);
    
    const response = await fetch(`${API_BASE_URL}/endpoints/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(dto),
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
  } catch (error) {
    console.error(`Failed to update endpoint ${id}:`, error);
    throw error;
  }
};

const deleteEndpoint = async (id: string): Promise<void> => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/endpoints/${id}`, {
      method: 'DELETE',
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
  } catch (error) {
    console.error(`Failed to delete endpoint ${id}:`, error);
    throw error;
  }
};

// Models CRUD operations
const getAllModels = async (): Promise<AiModel[]> => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/models`, {
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    const dtos = await response.json() as ModelDto[];
    return dtos.map(dto => toAiModel(dto));
  } catch (error) {
    console.error('Failed to fetch models:', error);
    throw error;
  }
};

const getModel = async (id: string): Promise<AiModel> => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/models/${id}`, {
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    const dto = await response.json() as ModelDto;
    return toAiModel(dto);
  } catch (error) {
    console.error(`Failed to fetch model ${id}:`, error);
    throw error;
  }
};

const createModel = async (model: AiModel): Promise<AiModel> => {
  try {
    const headers = await getAuthHeaders();
    const dto = toCreateModelDto(model);
    
    
    const response = await fetch(`${API_BASE_URL}/models`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dto),
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    const createdDto = await response.json() as ModelDto;
    return toAiModel(createdDto);
  } catch (error) {
    console.error('Failed to create model:', error);
    throw error;
  }
};

const updateModel = async (id: string, model: AiModel): Promise<void> => {
  try {
    const headers = await getAuthHeaders();
    const dto = toUpdateModelDto(model);
    
    const response = await fetch(`${API_BASE_URL}/models/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(dto),
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
  } catch (error) {
    console.error(`Failed to update model ${id}:`, error);
    throw error;
  }
};

const deleteModel = async (id: string): Promise<void> => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/models/${id}`, {
      method: 'DELETE',
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
  } catch (error) {
    console.error(`Failed to delete model ${id}:`, error);
    throw error;
  }
};

// Assistants CRUD operations
const getAllSystemAssistants = async (): Promise<AiAssistant[]> => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/assistants`, {
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    const dtos = await response.json() as AssistantDto[];
    return dtos.map(dto => toAiAssistant(dto));
  } catch (error) {
    console.error('Failed to fetch assistants:', error);
    throw error;
  }
};

const getAssistant = async (id: string): Promise<AiAssistant> => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/assistants/${id}`, {
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    const dto = await response.json() as AssistantDto;
    return toAiAssistant(dto);
  } catch (error) {
    console.error(`Failed to fetch assistant ${id}:`, error);
    throw error;
  }
};

const createAssistant = async (assistant: AiAssistant): Promise<AiAssistant> => {
  try {
    const headers = await getAuthHeaders();
    const dto = toCreateAssistantDto(assistant);
    
    
    const response = await fetch(`${API_BASE_URL}/assistants`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dto),
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    const createdDto = await response.json() as AssistantDto;
    return toAiAssistant(createdDto);
  } catch (error) {
    console.error('Failed to create assistant:', error);
    throw error;
  }
};

const updateAssistant = async (id: string, assistant: AiAssistant): Promise<void> => {
  try {
    const headers = await getAuthHeaders();
    const dto = toUpdateAssistantDto(assistant);
    
    const response = await fetch(`${API_BASE_URL}/assistants/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(dto),
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
  } catch (error) {
    console.error(`Failed to update assistant ${id}:`, error);
    throw error;
  }
};

const deleteAssistant = async (id: string): Promise<void> => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/assistants/${id}`, {
      method: 'DELETE',
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
  } catch (error) {
    console.error(`Failed to delete assistant ${id}:`, error);
    throw error;
  }
};

// AiAssistant interfaces and conversion functions
interface AiAssistant {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: AiModel;
  modelSettings: AiModelSettings;
  tools: any[]; // We don't have the tool type defined yet
  isSystemCreated: boolean;
  ownerId: string;
  sharedWithUserIds: string[];
  preloadedDocumentIds: string[];
}

// Convert AssistantDto to AiAssistant
const toAiAssistant = (dto: AssistantDto): AiAssistant => {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    systemPrompt: dto.systemPrompt,
    model: toAiModel(dto.model),
    modelSettings: dto.modelSettings,
    tools: [], // We're not handling tools right now
    isSystemCreated: dto.ownerId === 'System',
    ownerId: dto.ownerId,
    sharedWithUserIds: dto.sharedWithUserIds,
    preloadedDocumentIds: dto.preloadedDocumentIds
  };
};

// Convert AiAssistant to CreateAssistantDto
const toCreateAssistantDto = (assistant: AiAssistant): CreateAssistantDto => {
  // Create a default model settings object if it doesn't exist
  const modelSettings = assistant.modelSettings || {
    temperature: 0.7,
    maxTokens: 4000,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    reasoningEffort: 'None'
  };
  
  return {
    name: assistant.name,
    description: assistant.description || '',
    systemPrompt: assistant.systemPrompt || '',
    modelId: assistant.model.id,
    modelSettings: modelSettings,
    toolIds: assistant.tools ? assistant.tools.map(t => t.id || '') : [],
    sharedWithUserIds: assistant.sharedWithUserIds || [],
    preloadedDocumentIds: assistant.preloadedDocumentIds || []
  };
};

// Convert AiAssistant to UpdateAssistantDto
const toUpdateAssistantDto = (assistant: AiAssistant): UpdateAssistantDto => {
  // Create a default model settings object if it doesn't exist
  const modelSettings = assistant.modelSettings || {
    temperature: 0.7,
    maxTokens: 4000,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    reasoningEffort: 'None'
  };
  
  return {
    id: assistant.id,
    name: assistant.name,
    description: assistant.description || '',
    systemPrompt: assistant.systemPrompt || '',
    modelId: assistant.model.id,
    modelSettings: modelSettings,
    toolIds: assistant.tools ? assistant.tools.map(t => t.id || '') : [],
    sharedWithUserIds: assistant.sharedWithUserIds || [],
    preloadedDocumentIds: assistant.preloadedDocumentIds || []
  };
};

// Export all service functions
export const adminService = {
  // Endpoints
  getAllEndpoints,
  getEndpoint,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
  
  // Models
  getAllModels,
  getModel,
  createModel,
  updateModel,
  deleteModel,
  
  // Assistants
  getAllSystemAssistants,
  getAssistant,
  createAssistant,
  updateAssistant,
  deleteAssistant
};

// Export the AiAssistant interface
export type { AiAssistant };
