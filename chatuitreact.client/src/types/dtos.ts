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
