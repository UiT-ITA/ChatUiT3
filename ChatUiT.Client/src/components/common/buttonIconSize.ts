import type { IconSize } from './Icon';
import type { Size } from './layout';

export type ButtonSize = 'xs' | Size;

/** The icon size inside a button of each size. */
export const BUTTON_ICON_SIZE: Record<ButtonSize, IconSize> = { xs: 'small', small: 'medium', medium: 'medium', large: 'large' };
