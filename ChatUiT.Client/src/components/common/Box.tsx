import React from 'react';
import { cx, splitBoxProps, splitLayoutProps, type BoxProps as BoxStyleProps, type LayoutProps } from './layout';
import './Box.css';

export interface BoxProps extends LayoutProps, BoxStyleProps, Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  // The element to render
  as?: React.ElementType;
  ref?: React.Ref<HTMLElement>;
}

/** A plain container with padding, fill, frame and clipping set through props. */
const Box: React.FC<BoxProps> = ({ as: Element = 'div', className, ...props }) => {
  const [box, hideClass, boxRest] = splitBoxProps(props);
  const [layout, rest] = splitLayoutProps(boxRest);
  return <Element className={cx(hideClass, className) || undefined} style={{ ...box, ...layout }} {...rest} />;
};

export default Box;
