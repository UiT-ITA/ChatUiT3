import './FloatingPanel.css';

// 'trigger' matches the width of the element the panel opens from
export type PanelWidth = 'auto' | 'small' | 'medium' | 'large' | 'xl' | 'trigger';

/** The classes of the floating panel surface. */
export const floatingPanelClass = (width: PanelWidth): string =>
  width === 'auto' || width === 'trigger' ? 'floating-panel' : `floating-panel floating-panel--${width}`;
