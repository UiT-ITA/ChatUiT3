// src/services/mockAssistantService.ts

export type AssistantCapability = 'vision' | 'internet' | 'reasoning';

export interface Assistant {
  id: string;
  name: string;
  description: string;
  capabilities: AssistantCapability[];
  iconName?: string; // Future support for custom icons
}

const mockAssistants: Assistant[] = [
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    description: "A balanced model offering good performance across most tasks with faster response times and lower cost.",
    capabilities: ['reasoning']
  },
  {
    id: "gpt-4",
    name: "GPT-4",
    description: "Advanced language model with improved reasoning and instruction following capabilities.",
    capabilities: ['reasoning', 'internet']
  },
  {
    id: "claude-2",
    name: "Claude 2",
    description: "Anthropic's helpful, harmless, and honest AI assistant with strong comprehension and reasoning.",
    capabilities: ['reasoning']
  },
  {
    id: "gpt-4-vision",
    name: "GPT-4 Vision",
    description: "Capable of understanding and reasoning about images in addition to text.",
    capabilities: ['vision', 'reasoning', 'internet']
  },
  {
    id: "claude-3-opus",
    name: "Claude 3 Opus",
    description: "Anthropic's most capable model, with excellent performance across tasks requiring deep analysis.",
    capabilities: ['vision', 'reasoning']
  }
];

export const getAllAssistants = (): Assistant[] => {
  return [...mockAssistants];
};

export const getAssistantById = (id: string): Assistant | undefined => {
  return mockAssistants.find(assistant => assistant.id === id);
};

export const getDefaultAssistant = (): Assistant => {
  return mockAssistants[0]; // GPT-3.5 Turbo as default
};
