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
