import { createContext } from 'react';

/** The element over the whole chat area that a code block in full view renders into. */
export const FillLayerContext = createContext<HTMLElement | null>(null);

/** Whether a code block is the copy shown in full view. */
export const FilledContext = createContext(false);
