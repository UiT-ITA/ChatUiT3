import type { IconName } from '../common/Icon';
import type { AssistantListDto } from '../../types/assistantModels';
import type { UserLanguageModelDto } from '../../types/modelModels';

export type Capability = 'vision' | 'tools' | 'reasoning';

export const CAPABILITIES: { key: Capability; icon: IconName }[] = [
  { key: 'vision', icon: 'eye' },
  { key: 'tools', icon: 'globe' },
  { key: 'reasoning', icon: 'brain' },
];

/** The capabilities of an assistant's model, in the order of CAPABILITIES. */
export function capabilityKeys(assistant: { modelId: string }, models: UserLanguageModelDto[]): Capability[] {
  const model = models.find(m => m.id === assistant.modelId)?.capabilities;
  const has = { vision: !!model?.vision, tools: !!model?.tools, reasoning: (model?.supportedEfforts.length ?? 0) > 0 };
  return CAPABILITIES.map(({ key }) => key).filter(key => has[key]);
}

/** Returns each assistant's capabilities, leaving out those that every assistant in the list has. */
export function distinctCapabilities(list: AssistantListDto, models: UserLanguageModelDto[]): (assistant: { modelId: string }) => Capability[] {
  const all = [...list.owned, ...list.system, ...list.shared].map(assistant => capabilityKeys(assistant, models));
  const common = CAPABILITIES.map(({ key }) => key).filter(key => all.length > 0 && all.every(keys => keys.includes(key)));
  return assistant => capabilityKeys(assistant, models).filter(key => !common.includes(key));
}
