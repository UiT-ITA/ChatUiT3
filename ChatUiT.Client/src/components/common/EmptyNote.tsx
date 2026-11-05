import React from 'react';
import { cx } from './layout';
import './EmptyNote.css';

interface EmptyNoteProps {
  // 'row' sits inside a list as one of its rows, 'framed' stands alone in a dashed frame
  variant?: 'row' | 'framed';
  children?: React.ReactNode;
}

/** A muted note that says there is nothing to show yet, or that it is loading. */
const EmptyNote: React.FC<EmptyNoteProps> = ({ variant = 'framed', children }) => (
  <div className={cx('empty-note', `empty-note--${variant}`, 't-ui-plain')}>{children}</div>
);

export default EmptyNote;
