"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  deviceMode: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setDeviceMode: (deviceMode: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [deviceMode, setDeviceModeState] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  // Load theme and device mode from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    const savedDeviceMode = localStorage.getItem('deviceMode') === 'true';
    
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      setThemeState(savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setThemeState(prefersDark ? 'dark' : 'light');
    }
    
    setDeviceModeState(savedDeviceMode);
    setMounted(true);
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (mounted) {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      localStorage.setItem('theme', theme);
      localStorage.setItem('deviceMode', deviceMode.toString());
    }
  }, [theme, deviceMode, mounted]);

  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const setDeviceMode = (newDeviceMode: boolean) => {
    setDeviceModeState(newDeviceMode);
  };

  // Listen for system theme changes when device mode is on
  useEffect(() => {
    if (mounted && deviceMode) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        const prefersDark = mediaQuery.matches;
        setThemeState(prefersDark ? 'dark' : 'light');
      };

      // Set initial theme based on system preference
      handleChange();

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [deviceMode, mounted]);

  return (
    <ThemeContext.Provider value={{ theme, deviceMode, toggleTheme, setTheme, setDeviceMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
