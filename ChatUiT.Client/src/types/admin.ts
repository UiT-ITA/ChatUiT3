import type { FullAssistantDto, CreateAssistantDto, UpdateAssistantDto, UserRole } from './assistantModels';
import type { DataClassification } from './modelModels';
import type { IconName } from '../components/common/Icon';

/** Where an endpoint points (the host). The host decides which protocols it serves and on what path. */
export type EndpointType = 'AzureOpenAI' | 'OpenAI' | 'Anthropic' | 'LlamaCpp' | 'Other' | 'MicrosoftFoundry';

/** The wire protocol a model answers on. A property of the model: one Foundry endpoint serves all three. */
export type ApiProtocol = 'OpenAiChatCompletions' | 'OpenAiResponses' | 'AnthropicMessages';

export const API_PROTOCOLS: ApiProtocol[] = ['OpenAiResponses', 'OpenAiChatCompletions', 'AnthropicMessages'];

/** The admin domains, in the order the sidebar and the admin overview list them. Each id is its route segment. */
export type AdminDomain = 'endpoints' | 'models' | 'assistants' | 'tools' | 'agents' | 'settings';

export const ADMIN_DOMAINS: AdminDomain[] = ['endpoints', 'models', 'assistants', 'tools', 'agents', 'settings'];

/** The icon shown next to each admin domain in the sidebar and the admin overview. */
export const ADMIN_DOMAIN_ICONS: Record<AdminDomain, IconName> = {
  endpoints: 'server',
  models: 'cpu',
  assistants: 'assistants',
  tools: 'tools',
  agents: 'code',
  settings: 'settings',
};

/** The pages under /admin/settings. Settings has no overview page and opens the first one. */
export type AdminSettingsPage = 'general';

export const ADMIN_SETTINGS_PAGES: AdminSettingsPage[] = ['general'];

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

export interface EndpointDeploymentDto {
  name: string;
  model: string;
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
  classification: DataClassification;
}

/** A tool as the admin panel sees it. Tools are code; only the policy is editable. */
export interface AdminToolDto {
  id: string;
  name: string;
  description: string;
  requiresConfirmation: boolean;
  requiredScopes: string[];
  execution: 'server' | 'client';
  /** The lowest classification of the toolbox's own functions. */
  classification: DataClassification;
  parametersSchema: Record<string, unknown> | null;
  /** The policy from code. */
  defaultPolicy: ToolAccessPolicyDto;
  /** The policy in force: the stored override, or the default. */
  policy: ToolAccessPolicyDto;
  isOverridden: boolean;
  updatedAt: string | null;
  /** Internal agents only: the functions the agent can call. */
  functions: AdminToolFunctionDto[] | null;
  /** The toolbox that holds this one as a child. Null for a top-level toolbox. */
  parentId: string | null;
}

/** A toolbox's name, after its parents' names for a child toolbox. */
export const toolboxLabel = (tool: AdminToolDto, tools: AdminToolDto[]): string => {
  const parent = tool.parentId ? tools.find(candidate => candidate.id === tool.parentId) : undefined;
  return parent ? `${toolboxLabel(parent, tools)} › ${tool.name}` : tool.name;
};

/** An internal agent definition (code) and the model an admin set for it. */
export interface InternalAgentDto {
  id: string;
  name: string;
  description: string;
  functions: AdminToolFunctionDto[];
  /** Null when none is set: a nested run uses the chat's model, and the Responses API cannot use the agent. */
  modelId: string | null;
  reasoningEffort: ReasoningEffortLevel | null;
  /** Whether the Responses API serves the agent, under its id. */
  exposedInApi: boolean;
  updatedAt: string | null;
}

/** What the internal agent editor saves. The server clamps the effort to what the model accepts. */
export interface InternalAgentSettingDto {
  modelId: string;
  reasoningEffort: ReasoningEffortLevel;
  /** Whether the Responses API serves the agent, under its id. */
  exposedInApi: boolean;
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

export interface ModelTestResultDto {
  success: boolean;
  response?: string | null;
  error?: string | null;
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
  /** Whether the Responses API serves this model, under its modelId, to callers with one of its roles. */
  exposedInApi: boolean;
  capabilities: ModelCapabilities;
  /** Empty string on a stored row that predates per-model protocols; such a row cannot be used until set. */
  apiProtocol: ApiProtocol | '';
  classification: DataClassification;
}

export interface CreateModelDto {
  modelId: string;      // Provider model identifier
  modelName: string;    // Friendly/display name
  description: string;
  endpointId: string;
  allowedRoles: UserRole[];
  /** Whether a user may pin an assistant on this model as their default. Policy, not capability. */
  allowedAsDefault: boolean;
  /** Whether the Responses API serves this model, under its modelId, to callers with one of its roles. */
  exposedInApi: boolean;
  capabilities: ModelCapabilities;
  apiProtocol: ApiProtocol;
  classification: DataClassification;
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
  /** Whether the Responses API serves this model, under its modelId, to callers with one of its roles. */
  exposedInApi: boolean;
  capabilities: ModelCapabilities;
  apiProtocol: ApiProtocol;
  classification: DataClassification;
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
