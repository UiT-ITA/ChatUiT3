import type { AssistantDto } from '../../types/assistantModels';

/** The assistant sections of the assistants page and list, with their title and empty-state keys. */
export const ASSISTANT_SECTIONS: { type: AssistantDto['type']; titleKey: string; emptyKey: string }[] = [
  { type: 'owned', titleKey: 'assistants.myAssistants', emptyKey: 'assistants.emptyStates.noPersonalAssistants' },
  { type: 'system', titleKey: 'assistants.systemAssistants', emptyKey: 'assistants.emptyStates.noSystemAssistants' },
  { type: 'shared', titleKey: 'assistants.sharedAssistants', emptyKey: 'assistants.emptyStates.noSharedAssistants' },
];
