import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(undefined);

const THEME_STORAGE_KEY = 'nexora_theme_preference';

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'earth' || saved === 'default') {
        return saved;
      }
    } catch {
      // localStorage may fail in restricted environments
    }
    return 'earth';
  });

  const isEarth = theme === 'earth';

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (theme === 'earth') {
      root.setAttribute('data-theme', 'earth');
      root.classList.add('theme-earth');
      body.setAttribute('data-theme', 'earth');
      body.classList.add('theme-earth');
    } else {
      root.removeAttribute('data-theme');
      root.classList.remove('theme-earth');
      body.removeAttribute('data-theme');
      body.classList.remove('theme-earth');
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'earth' ? 'default' : 'earth'));
  };

  const setTheme = (newTheme) => {
    if (newTheme === 'earth' || newTheme === 'default') {
      setThemeState(newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, isEarth, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
