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

/**
 * How a model handles the `temperature` parameter. A boolean cannot express the gpt-5.x
 * rule, where temperature is only accepted while reasoning is switched off.
 */
export type TemperatureSupport = 'Unsupported' | 'Supported' | 'SupportedWhenReasoningDisabled';

/** Ascending; the ladder differs per model. */
export type ReasoningEffortLevel = 'None' | 'Low' | 'Medium' | 'High' | 'XHigh' | 'Max';

export const REASONING_EFFORT_ORDER: ReasoningEffortLevel[] = [
  'None', 'Low', 'Medium', 'High', 'XHigh', 'Max',
];

export interface ModelCapabilities {
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  temperature: TemperatureSupport;
  /** Empty means the model does not reason; omitting 'None' means reasoning cannot be turned off. */
  supportedEfforts: ReasoningEffortLevel[];
  maxContextTokens: number;
  maxOutputTokens: number;
  defaultMaxOutputTokens: number;
  knowledgeCutoff: string | null; // ISO date string, null when unknown
  /** Token counting scheme id (e.g. "o200k-tile"), or null when the model has no counter. */
  tokenCountingScheme: string | null;
}

export interface ModelDto {
  id: string;
  modelId: string;      // Provider model identifier (e.g. "gpt-5.4")
  modelName: string;    // Friendly/display name
  description: string;
  endpointId: string;
  allowedRoles: UserRole[];
  /** Whether a user may pin an assistant on this model as their default. Policy, not capability. */
  allowedAsDefault: boolean;
  capabilities: ModelCapabilities;
}

export interface CreateModelDto {
  modelId: string;      // Provider model identifier
  modelName: string;    // Friendly/display name
  description: string;
  endpointId: string;
  allowedRoles: UserRole[];
  /** Whether a user may pin an assistant on this model as their default. Policy, not capability. */
  allowedAsDefault: boolean;
  capabilities: ModelCapabilities;
}

export interface UpdateModelDto {
  id: string;
  modelId: string;      // Provider model identifier
  modelName: string;    // Friendly/display name
  description: string;
  endpointId: string;
  allowedRoles: UserRole[];
  /** Whether a user may pin an assistant on this model as their default. Policy, not capability. */
  allowedAsDefault: boolean;
  capabilities: ModelCapabilities;
}

/**
 * A model we have verified capability defaults for. Used to prefill the admin form; the
 * saved model row is still what the server sends at request time.
 */
export interface CatalogModelDto {
  modelId: string;
  displayName: string;
  description: string;
  provider: EndpointType;
  capabilities: ModelCapabilities;
}

export interface AppSettingsDto {
  defaultModelId: string;      // Model.id preselected when creating assistants
  chatNamingModelId: string;   // Model.id used to name new chats
  defaultAssistantId: string;  // Assistant.id a new chat starts on when the user has no pin
}

export interface UpdateAppSettingsDto {
  defaultModelId: string;
  chatNamingModelId: string;
  defaultAssistantId: string;
}

export type AdminAssistantDto = FullAssistantDto;
export type CreateAdminAssistantDto = CreateAssistantDto;
export type UpdateAdminAssistantDto = UpdateAssistantDto;
