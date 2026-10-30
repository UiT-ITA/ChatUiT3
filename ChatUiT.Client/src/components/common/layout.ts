import type { CSSProperties } from 'react';

export type Space = 'none' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type Size = 'small' | 'medium' | 'large';
// Margins also take 'auto', which pushes the element to the far end of a row or column
export type Margin = Space | 'auto';
export type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type Justify = 'start' | 'center' | 'end' | 'between' | 'around';

/** Placement parameters every shared component takes. */
export interface LayoutProps {
  m?: Margin;
  mt?: Margin;
  mr?: Margin;
  mb?: Margin;
  ml?: Margin;
  mx?: Margin;
  my?: Margin;
  // A CSS length, or 'full' for 100%
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  grow?: boolean;
  shrink?: boolean;
  alignSelf?: Exclude<Align, 'baseline'>;
}

export const space = (value: Margin): string => (value === 'auto' ? 'auto' : `var(--space-${value})`);

const length = (value: string): string => (value === 'full' ? '100%' : value);

export const flexValue = (value: Align | Justify): string => {
  switch (value) {
    case 'start': return 'flex-start';
    case 'end': return 'flex-end';
    case 'between': return 'space-between';
    case 'around': return 'space-around';
    default: return value;
  }
};

/** Splits the placement parameters off a component's props and turns them into an inline style. */
export function splitLayoutProps<P extends LayoutProps & { style?: CSSProperties }>(props: P): [CSSProperties | undefined, Omit<P, keyof LayoutProps | 'style'>] {
  const { m, mt, mr, mb, ml, mx, my, width, minWidth, maxWidth, grow, shrink, alignSelf, style, ...rest } = props;
  const layout: CSSProperties = {};
  if (m) layout.margin = space(m);
  if (my) { layout.marginTop = space(my); layout.marginBottom = space(my); }
  if (mx) { layout.marginLeft = space(mx); layout.marginRight = space(mx); }
  if (mt) layout.marginTop = space(mt);
  if (mr) layout.marginRight = space(mr);
  if (mb) layout.marginBottom = space(mb);
  if (ml) layout.marginLeft = space(ml);
  if (width) layout.width = length(width);
  if (minWidth) layout.minWidth = length(minWidth);
  if (maxWidth) layout.maxWidth = length(maxWidth);
  if (grow !== undefined) layout.flexGrow = grow ? 1 : 0;
  if (shrink !== undefined) layout.flexShrink = shrink ? 1 : 0;
  if (alignSelf) layout.alignSelf = flexValue(alignSelf);
  const merged = Object.keys(layout).length > 0 || style ? { ...layout, ...style } : undefined;
  return [merged, rest];
}

/** Joins class names, skipping empty ones. */
export const cx = (...names: unknown[]): string =>
  names.filter((name): name is string => typeof name === 'string' && name.length > 0).join(' ');
