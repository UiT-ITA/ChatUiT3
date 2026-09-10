import { signal } from '@preact/signals-react';

// Whether the right-hand conversation panel is open (wide screens only)
export const conversationPanelOpenSignal = signal(true);

// Anchor id of the help heading currently in view; drives the side menu highlight
export const helpActiveHeadingSignal = signal<string | null>(null);
