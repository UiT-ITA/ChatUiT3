import React from 'react';
import { cx, length, space, type Length, type Space } from './layout';
import './CenteredColumn.css';

interface CenteredColumnProps {
  maxWidth: Length;
  pt?: Space;
  px?: Space;
  pb?: Space;
  // Padding on narrow (mobile) screens. Each falls back to the wide-screen value.
  mobilePt?: Space;
  mobilePx?: Space;
  mobilePb?: Space;
  // Centres the column vertically too, in the free space of a flex column
  middle?: boolean;
  children?: React.ReactNode;
}

/** A column centred in its container, with a maximum width and padding that can differ on narrow screens. */
const CenteredColumn: React.FC<CenteredColumnProps> = ({ maxWidth, pt = 'none', px = 'none', pb = 'none', mobilePt, mobilePx, mobilePb, middle = false, children }) => {
  const style = {
    '--centered-column-max-width': length(maxWidth),
    '--centered-column-pt': space(pt),
    '--centered-column-px': space(px),
    '--centered-column-pb': space(pb),
    '--centered-column-mobile-pt': space(mobilePt ?? pt),
    '--centered-column-mobile-px': space(mobilePx ?? px),
    '--centered-column-mobile-pb': space(mobilePb ?? pb),
  } as React.CSSProperties;
  return <div className={cx('centered-column', middle && 'centered-column--middle')} style={style}>{children}</div>;
};

export default CenteredColumn;
