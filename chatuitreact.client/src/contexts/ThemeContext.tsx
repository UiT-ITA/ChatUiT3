import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'alt-dark';
export type TextScale = 'small' | 'medium' | 'large';
export type ChatWidth = 'small' | 'medium' | 'large' | 'full';

interface ThemeContextType {
  theme: Theme;
  textScale: TextScale;
  chatWidth: ChatWidth;
  markdownEnabled: boolean;
  setTheme: (theme: Theme) => void;
  setTextScale: (scale: TextScale) => void;
  setChatWidth: (width: ChatWidth) => void;
  setMarkdownEnabled: (enabled: boolean) => void;
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

  const [chatWidth, setChatWidthState] = useState<ChatWidth>(() => {
    const saved = localStorage.getItem('app-chat-width');
    if (saved && ['small', 'medium', 'large', 'full'].includes(saved)) {
      return saved as ChatWidth;
    }
    return 'medium';
  });

  const [markdownEnabled, setMarkdownEnabledState] = useState<boolean>(() => {
    const saved = localStorage.getItem('app-markdown-enabled');
    return saved !== 'false';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('app-theme', newTheme);
  };

  const setTextScale = (newScale: TextScale) => {
    setTextScaleState(newScale);
    localStorage.setItem('app-text-scale', newScale);
  };

  const setChatWidth = (newWidth: ChatWidth) => {
    setChatWidthState(newWidth);
    localStorage.setItem('app-chat-width', newWidth);
  };

  const setMarkdownEnabled = (enabled: boolean) => {
    setMarkdownEnabledState(enabled);
    localStorage.setItem('app-markdown-enabled', enabled.toString());
  };

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove('theme-light', 'theme-dark', 'theme-alt-dark');
    // Remove all scale classes
    root.classList.remove('scale-small', 'scale-medium', 'scale-large');
    // Remove all chat width classes
    root.classList.remove('chat-width-small', 'chat-width-medium', 'chat-width-large', 'chat-width-full');
    
    // Apply current theme, scale, and chat width
    root.classList.add(`theme-${theme}`);
    root.classList.add(`scale-${textScale}`);
    root.classList.add(`chat-width-${chatWidth}`);
  }, [theme, textScale, chatWidth]);

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
    chatWidth,
    markdownEnabled,
    setTheme,
    setTextScale,
    setChatWidth,
    setMarkdownEnabled,
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
