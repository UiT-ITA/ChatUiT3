import type { CSSProperties } from 'react';

// The spacing steps of the --space-* scale, and 'none' for no space
export type Space = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type Size = 'small' | 'medium' | 'large';
// Margins also take 'auto', which pushes the element to the far end of a row or column
export type Margin = Space | 'auto';
export type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type Justify = 'start' | 'center' | 'end' | 'between' | 'around';
// The steps of the --size-* scale
export type SizeStep = '3xs' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
// A size step, 'full' for 100%, 'half-screen' for half the viewport height, 'auto', 'none' or '0'
export type Length = SizeStep | 'full' | 'half-screen' | 'auto' | 'none' | '0';
export type BorderWidth = 'md' | 'lg';

/** Placement parameters every shared component takes. */
export interface LayoutProps {
  mt?: Margin;
  mr?: Margin;
  mb?: Margin;
  ml?: Margin;
  mx?: Margin;
  my?: Margin;
  width?: Length;
  minWidth?: Length;
  maxWidth?: Length;
  grow?: boolean;
  shrink?: boolean;
  // Takes the remaining space of a flex container, from a zero basis (flex: 1)
  expand?: boolean;
  alignSelf?: Exclude<Align, 'baseline'>;
}

const KEYWORD_SPACE: Partial<Record<Margin, string>> = { auto: 'auto', none: '0' };
const KEYWORD_LENGTH: Partial<Record<Length, string>> = { full: '100%', 'half-screen': '50vh', auto: 'auto', none: 'none', '0': '0' };

export const space = (value: Margin): string => KEYWORD_SPACE[value] ?? `var(--space-${value})`;

export const length = (value: Length): string => KEYWORD_LENGTH[value] ?? `var(--size-${value})`;

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
  const { mt, mr, mb, ml, mx, my, width, minWidth, maxWidth, grow, shrink, expand, alignSelf, style, ...rest } = props;
  const layout: CSSProperties = {};
  if (my) { layout.marginTop = space(my); layout.marginBottom = space(my); }
  if (mx) { layout.marginLeft = space(mx); layout.marginRight = space(mx); }
  if (mt) layout.marginTop = space(mt);
  if (mr) layout.marginRight = space(mr);
  if (mb) layout.marginBottom = space(mb);
  if (ml) layout.marginLeft = space(ml);
  if (width) layout.width = length(width);
  if (minWidth) layout.minWidth = length(minWidth);
  if (maxWidth) layout.maxWidth = length(maxWidth);
  if (expand) layout.flex = 1;
  if (grow !== undefined) layout.flexGrow = grow ? 1 : 0;
  if (shrink !== undefined) layout.flexShrink = shrink ? 1 : 0;
  if (alignSelf) layout.alignSelf = flexValue(alignSelf);
  const merged = Object.keys(layout).length > 0 || style ? { ...layout, ...style } : undefined;
  return [merged, rest];
}

export type BorderSide = 'all' | 'top' | 'bottom' | 'left';

/** Box parameters shared by Box, Stack and Grid: padding, frame and clipping. */
export interface BoxProps {
  p?: Space;
  px?: Space;
  py?: Space;
  pt?: Space;
  pb?: Space;
  pl?: Space;
  // A hairline frame, in the normal or soft line colour, or a brand colour
  border?: boolean | 'soft' | 'accent-2';
  // A frame heavier than the hairline, from the --border-* scale
  borderWidth?: BorderWidth;
  // The sides the frame is drawn on
  borderSide?: BorderSide;
  overflow?: 'hidden' | 'y-auto';
  position?: 'relative';
  height?: Length;
  minHeight?: Length;
  maxHeight?: Length;
}

const BORDER_COLOUR = { line: 'var(--line)', soft: 'var(--line-soft)', 'accent-2': 'var(--accent-2)' };

const BORDER_SIDES: Record<BorderSide, 'border' | 'borderTop' | 'borderBottom' | 'borderLeft'> = {
  all: 'border', top: 'borderTop', bottom: 'borderBottom', left: 'borderLeft',
};

/** Splits the box parameters off a component's props and turns them into an inline style. */
export function splitBoxProps<P extends BoxProps>(props: P): [CSSProperties, Omit<P, keyof BoxProps>] {
  const { p, px, py, pt, pb, pl, border, borderSide = 'all', borderWidth, overflow, position, height, minHeight, maxHeight, ...rest } = props;
  const style: CSSProperties = {};
  if (p) { style.paddingTop = space(p); style.paddingRight = space(p); style.paddingBottom = space(p); style.paddingLeft = space(p); }
  if (py) { style.paddingTop = space(py); style.paddingBottom = space(py); }
  if (px) { style.paddingLeft = space(px); style.paddingRight = space(px); }
  if (pt) style.paddingTop = space(pt);
  if (pb) style.paddingBottom = space(pb);
  if (pl) style.paddingLeft = space(pl);
  if (border) style[BORDER_SIDES[borderSide]] = `var(--border-${borderWidth ?? 'sm'}) solid ${BORDER_COLOUR[border === true ? 'line' : border]}`;
  if (overflow === 'y-auto') style.overflowY = 'auto';
  else if (overflow) style.overflow = overflow;
  if (position) style.position = position;
  if (height) style.height = length(height);
  if (minHeight) style.minHeight = length(minHeight);
  if (maxHeight) style.maxHeight = length(maxHeight);
  return [style, rest];
}

/** Joins class names, skipping empty ones. */
export const cx = (...names: unknown[]): string =>
  names.filter((name): name is string => typeof name === 'string' && name.length > 0).join(' ');

/** A --space-* step in pixels at the current root font size, for library props that take pixels. */
export const spacePx = (value: Space): number => {
  const root = getComputedStyle(document.documentElement);
  return parseFloat(root.getPropertyValue(`--space-${value}`)) * parseFloat(root.fontSize);
};
