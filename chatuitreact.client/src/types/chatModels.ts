import { AiModel, AiModelSettings } from './aiModels';

// AI Chat Models (from AiChatModels.cs)

export interface ChatListItem {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    status: ChatStatus;
}

export interface Chat extends ChatListItem {
    settings: ChatSettings;
    messages: ChatMessage[];
}

export interface ChatMessage {
    id: string;
    role: ChatRole;
    timestamp: Date;
    content: string;
    status: ChatStatus;
}

export interface ChatSettings {
    assistantName: string;
    systemPrompt: string;
    model: AiModel;
    modelSettings: AiModelSettings;
    saveToDB: boolean;
}

export enum ChatRole {
    User = 'User',
    Assistant = 'Assistant',
    System = 'System',
    ToolRequest = 'ToolRequest',
    ToolResponse = 'ToolResponse',
}

export enum ContentType {
    Text = 'Text',
    Image = 'Image',
    Mixed = 'Mixed',
}

export enum ChatStatus {
    New = 'New',
    Generating = 'Generating',
    Success = 'Success',
    Error = 'Error',
    Cancelled = 'Cancelled',
}


