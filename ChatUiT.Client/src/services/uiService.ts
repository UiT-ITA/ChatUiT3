import { signal } from '@preact/signals-react';

// Whether the right-hand conversation panel is open (wide screens only)
export const conversationPanelOpenSignal = signal(false);

// Anchor id of the help heading currently in view; drives the side menu highlight
export const helpActiveHeadingSignal = signal<string | null>(null);

/** The back button and save/cancel buttons an edit page shows in the main header. */
export interface EditorHeaderConfig {
  backPath: string;
  backLabel: string;
  dirty: boolean;
  saveLabel: string;
  saveDisabled: boolean;
  onSave: () => void;
  onCancel: () => void;
}

// The open edit page's header buttons; undefined when no edit page is open
export const editorHeaderSignal = signal<EditorHeaderConfig | undefined>(undefined);
