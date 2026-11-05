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
  m?: Margin;
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
  const { m, mt, mr, mb, ml, mx, my, width, minWidth, maxWidth, grow, shrink, expand, alignSelf, style, ...rest } = props;
  const layout: CSSProperties = {};
  if (m) { layout.marginTop = space(m); layout.marginRight = space(m); layout.marginBottom = space(m); layout.marginLeft = space(m); }
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

export type Surface = 'bg' | 'panel' | 'panel-2' | 'surface' | 'raised' | 'tint' | 'sel' | 'code' | 'transparent';
export type Radius = 'none' | 'sm' | 'md' | 'lg' | 'pill' | 'round';
export type BorderSide = 'all' | 'top' | 'right' | 'bottom' | 'left' | 'x' | 'y';

/** Box parameters shared by Box, Stack and Grid: padding, fill, frame and clipping. */
export interface BoxProps {
  p?: Space;
  px?: Space;
  py?: Space;
  pt?: Space;
  pr?: Space;
  pb?: Space;
  pl?: Space;
  // Background fill
  surface?: Surface;
  // A hairline frame, in the normal, soft or strong line colour, or a brand colour
  border?: boolean | 'soft' | 'strong' | 'accent-2';
  // A frame heavier than the hairline, from the --border-* scale
  borderWidth?: BorderWidth;
  // The sides the frame is drawn on
  borderSide?: BorderSide;
  borderStyle?: 'solid' | 'dashed';
  radius?: Radius;
  shadow?: 'card' | 'overlay';
  overflow?: 'hidden' | 'auto' | 'x-auto' | 'y-auto' | 'visible';
  position?: 'relative' | 'absolute' | 'sticky';
  height?: Length;
  minHeight?: Length;
  maxHeight?: Length;
  // Hides the element on narrow (mobile) or wide (desktop) screens
  hideOn?: 'mobile' | 'desktop';
}

const SURFACE: Record<Surface, string> = {
  bg: 'var(--bg)', panel: 'var(--panel)', 'panel-2': 'var(--panel-2)', surface: 'var(--surface)', raised: 'var(--surface-raised)',
  tint: 'var(--tint)', sel: 'var(--sel)', code: 'var(--code-bg)', transparent: 'transparent',
};

const RADIUS: Record<Radius, string> = { none: '0', sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', pill: 'var(--radius-pill)', round: '50%' };

const BORDER_COLOUR = { line: 'var(--line)', soft: 'var(--line-soft)', strong: 'var(--line-strong)', 'accent-2': 'var(--accent-2)' };

const BORDER_SIDES: Record<BorderSide, ('border' | 'borderTop' | 'borderRight' | 'borderBottom' | 'borderLeft')[]> = {
  all: ['border'], top: ['borderTop'], right: ['borderRight'], bottom: ['borderBottom'], left: ['borderLeft'], x: ['borderLeft', 'borderRight'], y: ['borderTop', 'borderBottom'],
};

/** Splits the box parameters off a component's props and turns them into an inline style and class names. */
export function splitBoxProps<P extends BoxProps>(props: P): [CSSProperties, string, Omit<P, keyof BoxProps>] {
  const { p, px, py, pt, pr, pb, pl, surface, border, borderSide = 'all', borderStyle = 'solid', borderWidth, radius, shadow, overflow, position, height, minHeight, maxHeight, hideOn, ...rest } = props;
  const style: CSSProperties = {};
  if (p) { style.paddingTop = space(p); style.paddingRight = space(p); style.paddingBottom = space(p); style.paddingLeft = space(p); }
  if (py) { style.paddingTop = space(py); style.paddingBottom = space(py); }
  if (px) { style.paddingLeft = space(px); style.paddingRight = space(px); }
  if (pt) style.paddingTop = space(pt);
  if (pr) style.paddingRight = space(pr);
  if (pb) style.paddingBottom = space(pb);
  if (pl) style.paddingLeft = space(pl);
  if (surface) style.background = SURFACE[surface];
  if (border) {
    const colour = BORDER_COLOUR[border === true ? 'line' : border];
    const line = `var(--border-${borderWidth ?? 'sm'}) ${borderStyle} ${colour}`;
    for (const side of BORDER_SIDES[borderSide]) style[side] = line;
  }
  if (radius) style.borderRadius = RADIUS[radius];
  if (shadow) style.boxShadow = `var(--shadow-${shadow})`;
  if (overflow === 'x-auto') { style.overflowX = 'auto'; }
  else if (overflow === 'y-auto') { style.overflowY = 'auto'; }
  else if (overflow) style.overflow = overflow;
  if (position) style.position = position;
  if (height) style.height = length(height);
  if (minHeight) style.minHeight = length(minHeight);
  if (maxHeight) style.maxHeight = length(maxHeight);
  return [style, hideOn ? `hide-on-${hideOn}` : '', rest];
}

/** Joins class names, skipping empty ones. */
export const cx = (...names: unknown[]): string =>
  names.filter((name): name is string => typeof name === 'string' && name.length > 0).join(' ');
