import React from 'react';
import { Icon } from './Icon';
import './CornerCheck.css';

/** A check badge in the bottom-right corner of a selected card. */
const CornerCheck: React.FC = () => (
  <span className="corner-check" aria-hidden="true">
    <Icon name="check" size="sm" />
  </span>
);

export default CornerCheck;
