import React from 'react';
import './Flag.css';

/** A decorative flag image, such as before a language name. */
const Flag: React.FC<{ src: string }> = ({ src }) => (
  <img src={src} alt="" className="flag" />
);

export default Flag;
