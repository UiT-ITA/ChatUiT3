import React from 'react';
import { cx } from './layout';
import './ImageFrame.css';

interface ImageFrameProps {
  src: string;
  alt: string;
  // Shows the image faded, as an unfinished preview
  dimmed?: boolean;
}

/** A framed image over a checkerboard, as wide as its container. */
const ImageFrame: React.FC<ImageFrameProps> = ({ src, alt, dimmed = false }) => (
  <img src={src} alt={alt} className={cx('image-frame', dimmed && 'image-frame--dimmed')} />
);

export default ImageFrame;
