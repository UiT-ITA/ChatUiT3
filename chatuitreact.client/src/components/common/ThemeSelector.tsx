import { useState, useEffect } from 'react';
import type { ThemeName } from '../../utils/themeUtils';
import { THEME_OPTIONS, setTheme, getCurrentTheme } from '../../utils/themeUtils';

export default function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>(getCurrentTheme);

  useEffect(() => {
    setCurrentTheme(getCurrentTheme());
  }, []);

  const handleThemeChange = (newTheme: ThemeName) => {
    setTheme(newTheme);
    setCurrentTheme(newTheme);
  };

  return (
    <div style={{ padding: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
      <label htmlFor="theme-selector" style={{ 
        display: 'block', 
        fontSize: '0.75rem', 
        color: 'var(--color-text-secondary)',
        marginBottom: '0.25rem'
      }}>
        Theme
      </label>
      <select
        id="theme-selector"
        value={currentTheme}
        onChange={(e) => handleThemeChange(e.target.value as ThemeName)}
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
        {THEME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
