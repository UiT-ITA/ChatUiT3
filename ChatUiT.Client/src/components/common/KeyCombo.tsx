import React from 'react';
import './KeyCombo.css';

/** Keyboard keys to press together, such as Shift + Enter. */
const KeyCombo: React.FC<{ keys: string[] }> = ({ keys }) => (
  <span className="key-combo">
    {keys.map((key, index) => (
      <span key={index}>
        {index > 0 && <span className="key-combo__plus">+</span>}
        <kbd className="key-combo__key t-caption-strong">{key}</kbd>
      </span>
    ))}
  </span>
);

export default KeyCombo;
