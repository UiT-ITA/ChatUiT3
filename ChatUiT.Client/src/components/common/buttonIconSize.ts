import type { IconSize } from './Icon';
import type { Size } from './layout';

// 'compact' is between xs and small, for framed chips in a dense row
export type ButtonSize = 'xs' | 'compact' | Size;

/** The icon size inside a button of each size. */
export const BUTTON_ICON_SIZE: Record<ButtonSize, IconSize> = { xs: 'sm', compact: 'sm', small: 'sm', medium: 'sm', large: 'md' };
