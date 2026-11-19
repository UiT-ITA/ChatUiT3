import React from 'react';
import { splitBoxProps, splitLayoutProps, type BoxProps as BoxStyleProps, type LayoutProps } from './layout';

export interface BoxProps extends LayoutProps, BoxStyleProps, Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  // The element to render
  as?: React.ElementType;
  ref?: React.Ref<HTMLElement>;
}

/** A plain container with padding, frame and clipping set through props. */
const Box: React.FC<BoxProps> = ({ as: Element = 'div', className, ...props }) => {
  const [box, boxRest] = splitBoxProps(props);
  const [layout, rest] = splitLayoutProps(boxRest);
  return <Element className={className} style={{ ...box, ...layout }} {...rest} />;
};

export default Box;
