import { ModelDto } from '../types/dtos';
import { modelCapabilities } from '../data/modelCapabilities';

export interface EnhancedModel extends ModelDto {
  displayName: string;
  description: string;
  capabilities: {
    reasoning: boolean;
    vision: boolean;
    tools: boolean;
    contextSize: number;
    maxOutputTokens: number;
    knowledgeCutoff: string;
  };
}

export function enhanceModelsWithCapabilities(models: ModelDto[]): EnhancedModel[] {
  return models.map(model => {
    const capability = modelCapabilities.find(cap => cap.id === model.modelName);
    
    return {
      ...model,
      displayName: capability?.name || model.modelName,
      description: capability?.description || 'No description available',
      capabilities: {
        reasoning: capability?.reasoning || false,
        vision: capability?.vision || false,
        tools: capability?.tools || false,
        contextSize: capability?.contextSize || 0,
        maxOutputTokens: capability?.maxOutputTokens || 0,
        knowledgeCutoff: capability?.knowledgeCutoff || 'Unknown'
      }
    };
  });
}

export interface AssistantCapabilities {
  vision: boolean;
  tools: boolean;
  reasoning: boolean;
}

// Get model name from assistant data
export function getModelNameFromAssistant(assistant: any): string {
  // For system assistants that have modelName directly
  if ('modelName' in assistant && assistant.modelName) {
    return assistant.modelName;
  }
  // For user/shared assistants that have model object
  if ('model' in assistant && assistant.model?.modelName) {
    return assistant.model.modelName;
  }
  return '';
}

// Get model capabilities from assistant
export function getAssistantCapabilities(assistant: any): AssistantCapabilities {
  const modelName = getModelNameFromAssistant(assistant);
  const modelInfo = modelCapabilities.find(m => m.id === modelName);
  
  return {
    vision: modelInfo?.vision || false,
    tools: modelInfo?.tools || false,
    reasoning: modelInfo?.reasoning || false
  };
}
