import type { FullAssistantDto, CreateAssistantDto, UpdateAssistantDto, UserRole } from './assistantModels';

/** Where an endpoint points (the host). The host decides which protocols it serves and on what path. */
export type EndpointType = 'AzureOpenAI' | 'OpenAI' | 'Anthropic' | 'LlamaCpp' | 'Other' | 'MicrosoftFoundry';

/** The wire protocol a model answers on. A property of the model: one Foundry endpoint serves all three. */
export type ApiProtocol = 'OpenAiChatCompletions' | 'OpenAiResponses' | 'AnthropicMessages';

export const API_PROTOCOLS: ApiProtocol[] = ['OpenAiResponses', 'OpenAiChatCompletions', 'AnthropicMessages'];

/**
 * The token counting schemes an admin can pick. Ids must match what the server parses
 * (TokenCountingSchemes.TryParse); labelKey names the i18n entry with the label and fit hint.
 * Ids contain dots, so they are not used as i18n keys themselves.
 */
export interface TokenCountingSchemeOption {
  id: string;
  labelKey: string;
  isEstimate: boolean;
}

export const TOKEN_COUNTING_SCHEME_OPTIONS: TokenCountingSchemeOption[] = [
  { id: 'o200k-tile', labelKey: 'o200k_tile', isEstimate: false },
  { id: 'o200k-patch-1.62', labelKey: 'o200k_patch_1_62', isEstimate: false },
  { id: 'cl100k-tile', labelKey: 'cl100k_tile', isEstimate: false },
  { id: 'anthropic-estimate', labelKey: 'anthropic_estimate', isEstimate: true },
  { id: 'char-est-4', labelKey: 'char_est_4', isEstimate: true },
  { id: 'char-est-3.5', labelKey: 'char_est_3_5', isEstimate: true },
  { id: 'word-count', labelKey: 'word_count', isEstimate: true },
];

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

export type { UserRole } from './assistantModels';

/** Who may use a tool: enabled, and any listed role or any listed Entra group. Both empty means nobody. */
export interface ToolAccessPolicyDto {
  enabled: boolean;
  allowedRoles: UserRole[];
  /** Entra ID group object ids. */
  allowedGroupIds: string[];
}

/** One private function of an internal agent, read-only in the admin panel. */
export interface AdminToolFunctionDto {
  id: string;
  description: string;
  requiresConfirmation: boolean;
  requiredScopes: string[];
}

/** A tool as the admin panel sees it. Tools are code; only the policy is editable. */
export interface AdminToolDto {
  id: string;
  name: string;
  description: string;
  requiresConfirmation: boolean;
  requiredScopes: string[];
  execution: 'server' | 'client';
  parametersSchema: Record<string, unknown> | null;
  /** The policy from code. */
  defaultPolicy: ToolAccessPolicyDto;
  /** The policy in force: the stored override, or the default. */
  policy: ToolAccessPolicyDto;
  isOverridden: boolean;
  updatedAt: string | null;
  /** Internal agents only: the functions the agent can call. */
  functions: AdminToolFunctionDto[] | null;
}

/** An internal agent definition (code) and the model an admin set for it. */
export interface InternalAgentDto {
  id: string;
  name: string;
  description: string;
  functions: AdminToolFunctionDto[];
  /** Null when none is set: a nested run uses the chat's model, and the Responses API cannot use the agent. */
  modelId: string | null;
  reasoningEffort: ReasoningEffortLevel | null;
  updatedAt: string | null;
}

/** What the internal agent editor saves. The server clamps the effort to what the model accepts. */
export interface InternalAgentSettingDto {
  modelId: string;
  reasoningEffort: ReasoningEffortLevel;
}

/** An Entra group from the admin group search. displayName is null when a stored id no longer resolves. */
export interface DirectoryGroupDto {
  id: string;
  displayName: string | null;
  description: string | null;
  mail: string | null;
}

/** The pseudo tool whose policy gates client-declared tools as a group. */
export const CLIENT_TOOLS_POLICY_ID = 'client_tools';

/** What a Responses API catalog entry serves: an internal agent, or a model row as it is. */
export type ApiCatalogKind = 'agent' | 'model';

/**
 * One entry of the Responses API catalog. The entry only admits callers; the agent's own
 * default and the model's roles still apply.
 */
export interface ApiCatalogEntryDto {
  /** What clients send as `model`. An agent's is its id. */
  publicId: string;
  kind: ApiCatalogKind;
  /** The internal agent id, or the model row id. */
  targetId: string;
  enabled: boolean;
  allowedRoles: UserRole[];
  allowedGroupIds: string[];
  updatedAt: string | null;
}

export type SaveApiCatalogEntryDto = Omit<ApiCatalogEntryDto, 'publicId' | 'updatedAt'>;

/** An internal agent the catalog can expose. Its model is set under Internal agents; only its entry is edited here. */
export interface ApiCatalogAgentDto {
  id: string;
  name: string;
  description: string;
  toolIds: string[];
  defaultPolicy: ToolAccessPolicyDto;
}

export interface ApiCatalogModelDto {
  id: string;
  modelName: string;
  modelId: string;
}

export interface ApiCatalogDto {
  entries: ApiCatalogEntryDto[];
  agents: ApiCatalogAgentDto[];
  models: ApiCatalogModelDto[];
}

export const API_PUBLIC_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

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

/**
 * Maps a chosen effort onto the nearest level the model accepts, mirroring the server's
 * clamping. A model that cannot reason resolves to 'None'; a model that always reasons
 * resolves 'None' up to its weakest level.
 */
export function clampEffort(
  requested: ReasoningEffortLevel | undefined,
  supported: ReasoningEffortLevel[] | undefined,
): ReasoningEffortLevel {
  const levels = supported ?? [];
  if (levels.length === 0) return 'None';

  const effort = requested ?? 'None';
  if (levels.includes(effort)) return effort;

  return levels[0];
}

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
  /** Empty string on a stored row that predates per-model protocols; such a row cannot be used until set. */
  apiProtocol: ApiProtocol | '';
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
  apiProtocol: ApiProtocol;
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
  apiProtocol: ApiProtocol;
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
  apiProtocol: ApiProtocol;
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
