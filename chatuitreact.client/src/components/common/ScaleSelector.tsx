import { useState, useEffect } from 'react';
import type { ScaleName } from '../../utils/scaleUtils';
import { SCALE_OPTIONS, setScale, getCurrentScale } from '../../utils/scaleUtils';

export default function ScaleSelector() {
  const [currentScale, setCurrentScale] = useState<ScaleName>(getCurrentScale);

  useEffect(() => {
    setCurrentScale(getCurrentScale());
  }, []);

  const handleScaleChange = (newScale: ScaleName) => {
    setScale(newScale);
    setCurrentScale(newScale);
  };

  return (
    <div style={{ padding: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
      <label htmlFor="scale-selector" style={{ 
        display: 'block', 
        fontSize: '0.75rem', 
        color: 'var(--color-text-secondary)',
        marginBottom: '0.25rem'
      }}>
        UI Scale
      </label>
      <select
        id="scale-selector"
        value={currentScale}
        onChange={(e) => handleScaleChange(e.target.value as ScaleName)}
        style={{
          width: '100%',
          padding: '0.25rem 0.5rem',
          backgroundColor: 'var(--color-bg-secondary)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
          borderRadius: '0.25rem',
          fontSize: '0.75rem'
        }}
      >
        {SCALE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
