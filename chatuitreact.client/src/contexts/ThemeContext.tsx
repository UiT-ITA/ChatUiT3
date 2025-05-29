import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'alt-dark';
export type TextScale = 'small' | 'medium' | 'large';

interface ThemeContextType {
  theme: Theme;
  textScale: TextScale;
  setTheme: (theme: Theme) => void;
  setTextScale: (scale: TextScale) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

const getSystemPreference = (): Theme => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  }
  return 'dark';
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('app-theme');
    if (saved && ['light', 'dark', 'alt-dark'].includes(saved)) {
      return saved as Theme;
    }
    return getSystemPreference();
  });

  const [textScale, setTextScaleState] = useState<TextScale>(() => {
    const saved = localStorage.getItem('app-text-scale');
    if (saved && ['small', 'medium', 'large'].includes(saved)) {
      return saved as TextScale;
    }
    return 'small';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('app-theme', newTheme);
  };

  const setTextScale = (newScale: TextScale) => {
    setTextScaleState(newScale);
    localStorage.setItem('app-text-scale', newScale);
  };

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove('theme-light', 'theme-dark', 'theme-alt-dark');
    // Remove all scale classes
    root.classList.remove('scale-small', 'scale-medium', 'scale-large');
    
    // Apply current theme and scale
    root.classList.add(`theme-${theme}`);
    root.classList.add(`scale-${textScale}`);
  }, [theme, textScale]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      const savedTheme = localStorage.getItem('app-theme');
      if (!savedTheme) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const contextValue: ThemeContextType = {
    theme,
    textScale,
    setTheme,
    setTextScale,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
