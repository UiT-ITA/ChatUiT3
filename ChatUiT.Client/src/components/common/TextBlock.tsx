import React from 'react';
import { cx } from './layout';
import './TextBlock.css';

/** A framed block of preformatted text, in the table text size, that scrolls when it is long. The surface is the code fill, or the panel fill for prose such as a message body. */
const TextBlock: React.FC<{ surface?: 'code' | 'panel'; monospace?: boolean; children?: React.ReactNode }> = ({ surface = 'code', monospace = false, children }) => (
  <div className={cx('text-block', surface === 'panel' && 'text-block--panel', monospace && 'text-block--mono', 't-table')}>{children}</div>
);

export default TextBlock;
