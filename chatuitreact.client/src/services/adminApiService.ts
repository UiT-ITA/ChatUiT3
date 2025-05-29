import { EndpointDto, CreateEndpointDto, UpdateEndpointDto, ModelDto, CreateModelDto, UpdateModelDto } from '../types/dtos';

// API error handling
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(response.status, errorText || response.statusText);
  }
  return response.json();
};

// Endpoint API functions
export const endpointApi = {
  async getAll(): Promise<EndpointDto[]> {
    const response = await fetch('/api/admin/endpoints');
    return handleResponse<EndpointDto[]>(response);
  },

  async getById(id: string): Promise<EndpointDto> {
    const response = await fetch(`/api/admin/endpoints/${id}`);
    return handleResponse<EndpointDto>(response);
  },

  async create(endpoint: CreateEndpointDto): Promise<EndpointDto> {
    const response = await fetch('/api/admin/endpoints', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(endpoint),
    });
    return handleResponse<EndpointDto>(response);
  },

  async update(id: string, endpoint: UpdateEndpointDto): Promise<EndpointDto> {
    const response = await fetch(`/api/admin/endpoints/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(endpoint),
    });
    return handleResponse<EndpointDto>(response);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`/api/admin/endpoints/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(response.status, errorText || response.statusText);
    }
  },
};

// Model API functions
export const modelApi = {
  async getAll(): Promise<ModelDto[]> {
    const response = await fetch('/api/admin/models');
    return handleResponse<ModelDto[]>(response);
  },

  async getById(id: string): Promise<ModelDto> {
    const response = await fetch(`/api/admin/models/${id}`);
    return handleResponse<ModelDto>(response);
  },

  async create(model: CreateModelDto): Promise<ModelDto> {
    const response = await fetch('/api/admin/models', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(model),
    });
    return handleResponse<ModelDto>(response);
  },

  async update(id: string, model: UpdateModelDto): Promise<ModelDto> {
    const response = await fetch(`/api/admin/models/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(model),
    });
    return handleResponse<ModelDto>(response);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`/api/admin/models/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(response.status, errorText || response.statusText);
    }
  },
};

// Error handling utilities
export const handleApiError = (error: unknown): string => {
  if (error instanceof ApiError) {
    return `API Error (${error.status}): ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
};
