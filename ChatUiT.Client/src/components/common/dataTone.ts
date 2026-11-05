import './dataTone.css';

export type DataTone = 'accent' | 'warn' | 'danger' | 'reserved' | 'viz-1' | 'viz-2' | 'viz-3' | 'viz-4' | 'viz-5';

/** The class that fills an element with a data colour. */
export const dataToneClass = (tone: DataTone): string => `data-tone--${tone}`;
