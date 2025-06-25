import { Chat, Message, ChatFile } from '../types/chatModels';
import { AssistantListDto } from '../types/dtos';

const API_BASE_URL = '/api';

class ApiService {
  private getAccessToken: (() => Promise<string | null>) | null = null;

  // Set the token getter function from AuthContext
  setTokenProvider(getAccessToken: () => Promise<string | null>) {
    this.getAccessToken = getAccessToken;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Get the access token for authentication
    const accessToken = await this.getAccessToken?.();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string> || {}),
    };

    // Add Bearer token if available
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized - Please login again');
      }
      if (response.status === 404) {
        window.location.replace('/c/new');
      }

      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return this.parseDates(data);
    }
    
    return null as T;
  }

  // Parse ISO date strings to Date objects
  private parseDates(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    
    if (typeof obj === 'string') {
      // Check if string is an ISO date
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj)) {
        return new Date(obj);
      }
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.parseDates(item));
    }
    
    if (typeof obj === 'object') {
      const result: any = {};
      for (const key in obj) {
        result[key] = this.parseDates(obj[key]);
      }
      return result;
    }
    
    return obj;
  }

  // Chat API
  async getChats(): Promise<Chat[]> {
    return this.request<Chat[]>('/chats');
  }

  async getChat(chatId: string): Promise<Chat> {
    return this.request<Chat>(`/chats/${chatId}`);
  }

  async getMessages(chatId: string, page = 1, size = 50): Promise<{ messages: Message[], hasMore: boolean }> {
    return this.request<{ messages: Message[], hasMore: boolean }>(`/chats/${chatId}/messages?page=${page}&size=${size}`);
  }

  async createChat(assistantId?: string, initialMessages?: Message[]): Promise<Chat> {
    return this.request<Chat>('/chats', {
      method: 'POST',
      body: JSON.stringify({ assistantId, initialMessages }),
    });
  }

  async sendMessage(chatId: string, content: string, files?: ChatFile[], assistantId?: string): Promise<Message> {
    return this.request<Message>(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, files, assistantId }),
    });
  }

  async deleteChat(chatId: string): Promise<void> {
    return this.request<void>(`/chats/${chatId}`, {
      method: 'DELETE',
    });
  }

  // Assistant API
  async getAssistants(): Promise<AssistantListDto> {
    return this.request<AssistantListDto>('/assistants');
  }

  async createAssistant(createDto: any): Promise<void> {
    return this.request<void>('/assistants', {
      method: 'POST',
      body: JSON.stringify(createDto),
    });
  }

  async updateAssistant(updateDto: any): Promise<void> {
    return this.request<void>('/assistants', {
      method: 'PUT',
      body: JSON.stringify(updateDto),
    });
  }

  async deleteAssistant(assistantId: string): Promise<void> {
    return this.request<void>(`/assistants/${assistantId}`, {
      method: 'DELETE',
    });
  }

  async toggleAssistantVisibility(assistantId: string): Promise<void> {
    return this.request<void>(`/assistants/${assistantId}/visibility`, {
      method: 'POST',
    });
  }

  async addSharedAssistant(assistantId: string): Promise<void> {
    return this.request<void>(`/assistants/shared/${assistantId}`, {
      method: 'POST',
    });
  }

  async generateShareLink(assistantId: string): Promise<string> {
    return this.request<string>(`/assistants/${assistantId}/share-link`, {
      method: 'POST',
    });
  }

  async getAvailableModels(): Promise<any[]> {
    return this.request<any[]>('/assistants/models');
  }

}

export const apiService = new ApiService();
