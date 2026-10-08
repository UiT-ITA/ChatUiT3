import type { IconName } from './Icon';
import type { AssistantDto } from '../../types/assistantModels';
import type { UserModelDto } from '../../types/modelModels';

export type Capability = 'vision' | 'tools' | 'reasoning';

export const CAPABILITIES: { key: Capability; icon: IconName }[] = [
  { key: 'vision', icon: 'eye' },
  { key: 'tools', icon: 'globe' },
  { key: 'reasoning', icon: 'brain' },
];

export function capabilitiesOf(assistant: AssistantDto, models: UserModelDto[]): Record<Capability, boolean> {
  const model = models.find(m => m.id === assistant.modelId);
  return {
    vision: !!model?.capabilities.vision,
    tools: !!model?.capabilities.tools,
    reasoning: (model?.capabilities.supportedEfforts.length ?? 0) > 0,
  };
}
