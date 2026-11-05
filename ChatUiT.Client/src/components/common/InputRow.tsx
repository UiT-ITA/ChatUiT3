import React from 'react';
import { length, type SizeStep } from './layout';
import './InputRow.css';

interface InputRowProps {
  // Max width of the row on wider screens
  maxWidth?: SizeStep;
  // A text input, then its action button
  children: React.ReactNode;
}

/** A text input with its action button beside it. On very narrow screens the button goes under the input at full width. */
const InputRow: React.FC<InputRowProps> = ({ maxWidth, children }) => (
  <div className="input-row" style={maxWidth ? { '--input-row-max-width': length(maxWidth) } as React.CSSProperties : undefined}>
    {children}
  </div>
);

export default InputRow;
