// AiModelEndpoint represents an API endpoint for AI service
export interface AiModelEndpoint {
  id: string;
  url: string;
  apiKey: string;
}

// AiModelType enum defines the supported model providers
export enum AiModelType {
  AzureOpenAI = 'AzureOpenAI',
  OpenAI = 'OpenAI',
  Anthropic = 'Anthropic',
  LlamaCpp = 'LlamaCpp',
  Other = 'Other'
}

// AiModelCapabilities defines what a model can do
export interface AiModelCapabilities {
  supportsVision: boolean;
  supportsReasoning: boolean;
  supportsFunctionCalling: boolean;
  supportsCodeInterpreter: boolean;
  maxContextLength: number;
  maxOutputLength: number;
}

// AiModel represents a specific AI model with its configuration
export interface AiModel {
  id: string;
  name: string;
  description: string;
  modelId: string;
  modelType: AiModelType;
  endpoint: AiModelEndpoint;
  capabilities: AiModelCapabilities;
}
