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
    messages: Message[];
}

// Extended chat list item that can optionally contain full chat data for caching
export interface CachedChatItem extends ChatListItem {
    settings?: ChatSettings;
    messages?: Message[];
    lastViewed?: Date;
}

export interface Message {
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
