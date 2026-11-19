import { cx } from './layout';
import './FloatingPanel.css';
import './Popover.css';

export type PanelWidth = 'auto' | 'small' | 'medium' | 'large' | 'xl';

/** The classes of the floating panel surface. */
export const floatingPanelClass = (width: PanelWidth = 'auto'): string =>
  cx('floating-panel', width !== 'auto' && `floating-panel--${width}`);
