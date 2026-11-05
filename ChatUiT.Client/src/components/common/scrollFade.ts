import { cx } from './layout';
import './Scroller.css';

export type ScrollFadeSize = 'default' | 'medium' | 'large';

/** Class names that fade the edges of a scroll area with more content beyond them, for elements the Scroller cannot wrap. */
export const scrollFadeClass = (axis: 'x' | 'y', size: ScrollFadeSize = 'default'): string =>
  cx(`scroll-fade-${axis}`, size !== 'default' && `scroll-fade--${size}`);
